"""
Drift checker: detects schema and descriptor drift between a live tool call
and the frozen contract stored at recording time.

Three drift dimensions are checked:
  - input_schema_drift   - the shape of the live call's ``params`` differs
                           from the contract's ``input_schema_hash``
  - output_schema_drift  - the shape of the live call's ``response`` differs
                           from the contract's ``output_schema_hash``
  - descriptor_drift     - the contract's own descriptor hash has changed
                           since the step was recorded (checked against the
                           ``snapshot.contract_descriptor_hash`` embedded in
                           the step at recording time)

Each drift finding is persisted as a ``DriftWarning`` row so the
/runs/{run_id}/warnings endpoint surfaces it automatically.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from proxytrace.contracts.registry import get_contract_or_default
from proxytrace.contracts.schema_hasher import hash_schema, hash_json
from proxytrace.db.models import Step
from proxytrace.db.repository import log_drift_warning


class DriftKind(str, Enum):
    INPUT_SCHEMA = "input_schema_drift"
    OUTPUT_SCHEMA = "output_schema_drift"
    DESCRIPTOR = "descriptor_drift"


@dataclass(frozen=True)
class DriftFinding:
    kind: DriftKind
    tool_name: str
    step_id: str
    old_hash: str | None
    new_hash: str | None
    detail: str


@dataclass
class DriftCheckResult:
    tool_name: str
    step_id: str
    drifted: bool = False
    findings: list[DriftFinding] = field(default_factory=list)


class DriftChecker:
    """
    Checks a single tool step for contract drift and persists warnings.

    Usage (from MCP proxy after recording a step)::

        checker = DriftChecker()
        result = await checker.check_step(session, step=step, run_id=run.run_id)
        if result.drifted:
            # findings are already persisted; optionally surface to caller
            ...
    """

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    async def check_step(
        self,
        session: AsyncSession,
        *,
        step: Step,
        run_id: str,
    ) -> DriftCheckResult:
        """
        Check *step* for contract drift and persist any findings.

        Returns a :class:`DriftCheckResult` describing what (if anything)
        drifted.  Findings are **always** written to ``drift_warnings`` before
        this method returns so callers do not need to handle persistence.

        Parameters
        ----------
        session:
            Active async SQLAlchemy session.  The caller is responsible for
            committing.
        step:
            The :class:`~proxytrace.db.models.Step` that was just recorded.
        run_id:
            Run the step belongs to (redundant with ``step.run_id`` but kept
            explicit to match the repository pattern used elsewhere).
        """
        if step.step_type != "tool":
            return DriftCheckResult(tool_name="", step_id=step.step_id, drifted=False)

        payload: dict[str, Any] = step.payload or {}
        tool_name: str = payload.get("tool_name") or payload.get("name", "")
        if not tool_name:
            return DriftCheckResult(tool_name="", step_id=step.step_id, drifted=False)

        contract = await get_contract_or_default(session, tool_name)
        result = DriftCheckResult(tool_name=tool_name, step_id=step.step_id)

        params: dict[str, Any] = payload.get("params") or {}
        response: Any = payload.get("response")

        # 1. Input schema drift
        finding = self._check_input_schema(step, tool_name, params, contract.input_schema_hash)
        if finding:
            result.findings.append(finding)

        # 2. Output schema drift
        if response is not None:
            finding = self._check_output_schema(step, tool_name, response, contract.output_schema_hash)
            if finding:
                result.findings.append(finding)

        # 3. Descriptor drift (only when the step was recorded with a snapshot
        #    that captures the contract hash at recording time)
        finding = self._check_descriptor(step, tool_name, contract.descriptor_hash)
        if finding:
            result.findings.append(finding)

        result.drifted = bool(result.findings)

        for f in result.findings:
            await log_drift_warning(
                session,
                run_id=run_id,
                step_id=step.step_id,
                warning_type=f.kind.value,
                old_hash=f.old_hash,
                new_hash=f.new_hash,
                details=f.detail,
            )

        return result

    # ------------------------------------------------------------------ #
    # Schema & descriptor comparisons                                     #
    # ------------------------------------------------------------------ #

    def _check_input_schema(
        self,
        step: Step,
        tool_name: str,
        params: dict[str, Any],
        contract_input_hash: str,
    ) -> DriftFinding | None:
        live_hash = hash_schema(params)
        if live_hash == contract_input_hash:
            return None
        return DriftFinding(
            kind=DriftKind.INPUT_SCHEMA,
            tool_name=tool_name,
            step_id=step.step_id,
            old_hash=contract_input_hash,
            new_hash=live_hash,
            detail=(
                f"Input schema for '{tool_name}' at step {step.step_index} "
                f"does not match the recorded contract. "
                f"Expected hash {contract_input_hash!r}, got {live_hash!r}. "
                "Verify that the tool's input parameters have not changed."
            ),
        )

    def _check_output_schema(
        self,
        step: Step,
        tool_name: str,
        response: Any,
        contract_output_hash: str,
    ) -> DriftFinding | None:
        live_hash = hash_schema(response)
        if live_hash == contract_output_hash:
            return None
        return DriftFinding(
            kind=DriftKind.OUTPUT_SCHEMA,
            tool_name=tool_name,
            step_id=step.step_id,
            old_hash=contract_output_hash,
            new_hash=live_hash,
            detail=(
                f"Output schema for '{tool_name}' at step {step.step_index} "
                f"does not match the recorded contract. "
                f"Expected hash {contract_output_hash!r}, got {live_hash!r}. "
                "The tool may have changed its response shape."
            ),
        )

    def _check_descriptor(
        self,
        step: Step,
        tool_name: str,
        current_descriptor_hash: str,
    ) -> DriftFinding | None:
        """
        Compare the descriptor hash embedded in ``step.snapshot`` against the
        current contract's ``descriptor_hash``.

        The MCP proxy embeds ``contract_descriptor_hash`` into
        ``step.snapshot`` at recording time.  If that key is absent (e.g. for
        steps recorded before this feature landed), the check is skipped to
        remain backwards compatible.
        """
        recorded_descriptor_hash: str | None = (step.snapshot or {}).get(
            "contract_descriptor_hash"
        )
        if recorded_descriptor_hash is None:
            return None
        if recorded_descriptor_hash == current_descriptor_hash:
            return None
        return DriftFinding(
            kind=DriftKind.DESCRIPTOR,
            tool_name=tool_name,
            step_id=step.step_id,
            old_hash=recorded_descriptor_hash,
            new_hash=current_descriptor_hash,
            detail=(
                f"Contract descriptor for '{tool_name}' has changed since "
                f"step {step.step_index} was recorded. "
                f"Recorded hash {recorded_descriptor_hash!r}, "
                f"current hash {current_descriptor_hash!r}. "
                "Promote the contract version or re-record the baseline."
            ),
        )
