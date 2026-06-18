"""initial ProxyTrace schema

Revision ID: 20260618_0001
Revises:
Create Date: 2026-06-18 00:01:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260618_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "runs",
        sa.Column("run_id", sa.String(length=36), nullable=False),
        sa.Column("agent_id", sa.String(length=128), nullable=False),
        sa.Column("jira_issue_key", sa.String(length=64), nullable=True),
        sa.Column("workspace_id", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("run_id"),
    )
    op.create_index("ix_runs_jira_issue_key", "runs", ["jira_issue_key"])
    op.create_index("ix_runs_status", "runs", ["status"])
    op.create_index("ix_runs_workspace_id", "runs", ["workspace_id"])

    op.create_table(
        "tool_contracts",
        sa.Column("tool_name", sa.String(length=128), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=False),
        sa.Column("tool_type", sa.String(length=32), nullable=False),
        sa.Column("input_schema_hash", sa.String(length=96), nullable=False),
        sa.Column("output_schema_hash", sa.String(length=96), nullable=False),
        sa.Column("descriptor_hash", sa.String(length=96), nullable=False),
        sa.Column("side_effect", sa.Boolean(), nullable=False),
        sa.Column("requires_approval", sa.Boolean(), nullable=False),
        sa.Column("replay_policy", sa.String(length=64), nullable=False),
        sa.Column("trust_level", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("tool_name", "version"),
    )

    op.create_table(
        "steps",
        sa.Column("step_id", sa.String(length=36), nullable=False),
        sa.Column("run_id", sa.String(length=36), nullable=False),
        sa.Column("step_index", sa.Integer(), nullable=False),
        sa.Column("step_type", sa.String(length=32), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["runs.run_id"]),
        sa.PrimaryKeyConstraint("step_id"),
        sa.UniqueConstraint("run_id", "step_index", name="uq_steps_run_index"),
    )
    op.create_index("ix_steps_run_id", "steps", ["run_id"])
    op.create_index("ix_steps_step_type", "steps", ["step_type"])

    op.create_table(
        "replays",
        sa.Column("replay_id", sa.String(length=36), nullable=False),
        sa.Column("run_id", sa.String(length=36), nullable=False),
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column("patch_step", sa.Integer(), nullable=True),
        sa.Column("patch_payload", sa.JSON(), nullable=False),
        sa.Column("verdict", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["runs.run_id"]),
        sa.PrimaryKeyConstraint("replay_id"),
    )
    op.create_index("ix_replays_run_id", "replays", ["run_id"])

    op.create_table(
        "regression_pack",
        sa.Column("test_id", sa.String(length=36), nullable=False),
        sa.Column("run_id", sa.String(length=36), nullable=False),
        sa.Column("replay_id", sa.String(length=36), nullable=True),
        sa.Column("assertions", sa.JSON(), nullable=False),
        sa.Column("promoted_at", sa.DateTime(), nullable=False),
        sa.Column("last_run_at", sa.DateTime(), nullable=True),
        sa.Column("pass_count", sa.Integer(), nullable=False),
        sa.Column("fail_count", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["replay_id"], ["replays.replay_id"]),
        sa.ForeignKeyConstraint(["run_id"], ["runs.run_id"]),
        sa.PrimaryKeyConstraint("test_id"),
    )
    op.create_index("ix_regression_pack_run_id", "regression_pack", ["run_id"])

    op.create_table(
        "drift_warnings",
        sa.Column("warning_id", sa.String(length=36), nullable=False),
        sa.Column("run_id", sa.String(length=36), nullable=False),
        sa.Column("step_id", sa.String(length=36), nullable=True),
        sa.Column("warning_type", sa.String(length=64), nullable=False),
        sa.Column("old_hash", sa.String(length=96), nullable=True),
        sa.Column("new_hash", sa.String(length=96), nullable=True),
        sa.Column("surfaced_at", sa.DateTime(), nullable=False),
        sa.Column("details", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["runs.run_id"]),
        sa.ForeignKeyConstraint(["step_id"], ["steps.step_id"]),
        sa.PrimaryKeyConstraint("warning_id"),
    )
    op.create_index("ix_drift_warnings_run_id", "drift_warnings", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_drift_warnings_run_id", table_name="drift_warnings")
    op.drop_table("drift_warnings")
    op.drop_index("ix_regression_pack_run_id", table_name="regression_pack")
    op.drop_table("regression_pack")
    op.drop_index("ix_replays_run_id", table_name="replays")
    op.drop_table("replays")
    op.drop_index("ix_steps_step_type", table_name="steps")
    op.drop_index("ix_steps_run_id", table_name="steps")
    op.drop_table("steps")
    op.drop_table("tool_contracts")
    op.drop_index("ix_runs_workspace_id", table_name="runs")
    op.drop_index("ix_runs_status", table_name="runs")
    op.drop_index("ix_runs_jira_issue_key", table_name="runs")
    op.drop_table("runs")
