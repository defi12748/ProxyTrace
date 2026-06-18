from __future__ import annotations

import argparse
import asyncio
import json

from proxytrace.agent_demo.agent import JiraTriagingAgent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the ProxyTrace Jira demo agent.")
    parser.add_argument("--issue-key", default="SCRUM-1")
    parser.add_argument("--summary", default="Task 1")
    parser.add_argument(
        "--description",
        default="Trace the Jira issue through ProxyTrace.",
    )
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    agent = JiraTriagingAgent()
    result = await agent.run(
        issue_key=args.issue_key,
        summary=args.summary,
        description=args.description,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
