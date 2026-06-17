from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship


Base = declarative_base()


def _uuid() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.utcnow()


class Run(Base):
    __tablename__ = "runs"

    run_id = Column(String(36), primary_key=True, default=_uuid)
    agent_id = Column(String(128), nullable=False)
    jira_issue_key = Column(String(64), nullable=True, index=True)
    workspace_id = Column(String(128), nullable=False, default="local-demo", index=True)
    status = Column(String(32), nullable=False, default="running", index=True)
    started_at = Column(DateTime, nullable=False, default=_now)
    completed_at = Column(DateTime, nullable=True)
    metadata_json = Column("metadata", JSON, nullable=False, default=dict)

    steps = relationship("Step", back_populates="run", cascade="all, delete-orphan")
    replays = relationship("Replay", back_populates="run", cascade="all, delete-orphan")


class Step(Base):
    __tablename__ = "steps"
    __table_args__ = (UniqueConstraint("run_id", "step_index", name="uq_steps_run_index"),)

    step_id = Column(String(36), primary_key=True, default=_uuid)
    run_id = Column(String(36), ForeignKey("runs.run_id"), nullable=False, index=True)
    step_index = Column(Integer, nullable=False)
    step_type = Column(String(32), nullable=False, index=True)  # llm | tool
    payload = Column(JSON, nullable=False, default=dict)
    snapshot = Column(JSON, nullable=False, default=dict)
    recorded_at = Column(DateTime, nullable=False, default=_now)

    run = relationship("Run", back_populates="steps")


class ToolContract(Base):
    __tablename__ = "tool_contracts"

    tool_name = Column(String(128), primary_key=True)
    version = Column(String(32), primary_key=True, default="v1")
    tool_type = Column(String(32), nullable=False)  # read | write | destructive
    input_schema_hash = Column(String(96), nullable=False)
    output_schema_hash = Column(String(96), nullable=False)
    descriptor_hash = Column(String(96), nullable=False)
    side_effect = Column(Boolean, nullable=False, default=False)
    requires_approval = Column(Boolean, nullable=False, default=False)
    replay_policy = Column(String(64), nullable=False, default="mock_from_recording")
    trust_level = Column(String(64), nullable=False, default="trusted_internal")
    created_at = Column(DateTime, nullable=False, default=_now)


class Replay(Base):
    __tablename__ = "replays"

    replay_id = Column(String(36), primary_key=True, default=_uuid)
    run_id = Column(String(36), ForeignKey("runs.run_id"), nullable=False, index=True)
    mode = Column(String(32), nullable=False)  # strict | exploratory
    patch_step = Column(Integer, nullable=True)
    patch_payload = Column(JSON, nullable=False, default=dict)
    verdict = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, nullable=False, default=_now)

    run = relationship("Run", back_populates="replays")


class RegressionPackItem(Base):
    __tablename__ = "regression_pack"

    test_id = Column(String(36), primary_key=True, default=_uuid)
    run_id = Column(String(36), ForeignKey("runs.run_id"), nullable=False, index=True)
    replay_id = Column(String(36), ForeignKey("replays.replay_id"), nullable=True)
    assertions = Column(JSON, nullable=False, default=dict)
    promoted_at = Column(DateTime, nullable=False, default=_now)
    last_run_at = Column(DateTime, nullable=True)
    pass_count = Column(Integer, nullable=False, default=0)
    fail_count = Column(Integer, nullable=False, default=0)


class DriftWarning(Base):
    __tablename__ = "drift_warnings"

    warning_id = Column(String(36), primary_key=True, default=_uuid)
    run_id = Column(String(36), ForeignKey("runs.run_id"), nullable=False, index=True)
    step_id = Column(String(36), ForeignKey("steps.step_id"), nullable=True)
    warning_type = Column(String(64), nullable=False)
    old_hash = Column(String(96), nullable=True)
    new_hash = Column(String(96), nullable=True)
    surfaced_at = Column(DateTime, nullable=False, default=_now)
    details = Column(Text, nullable=False, default="")

