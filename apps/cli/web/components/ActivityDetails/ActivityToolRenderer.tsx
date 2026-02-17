import type { AgentActivity } from "@safeclaw/shared";
import type { ParsedActivity } from "../../lib/activityParser.js";
import {
  FileOperationRenderer,
  ShellCommandRenderer,
  WebBrowseRenderer,
  MessageRenderer,
  ToolCallRenderer,
  UnknownRenderer,
} from "./renderers/index.js";

interface Props {
  activity: AgentActivity;
  parsed: ParsedActivity;
}

export function ActivityToolRenderer({ activity, parsed }: Props) {
  // Route to the appropriate renderer based on activity type
  switch (activity.activityType) {
    case "file_read":
    case "file_write":
      return <FileOperationRenderer activity={activity} parsed={parsed} />;

    case "shell_command":
      return <ShellCommandRenderer activity={activity} parsed={parsed} />;

    case "web_browse":
      return <WebBrowseRenderer activity={activity} parsed={parsed} />;

    case "message":
      return <MessageRenderer activity={activity} parsed={parsed} />;

    case "tool_call":
      return <ToolCallRenderer activity={activity} parsed={parsed} />;

    case "unknown":
    default:
      return <UnknownRenderer activity={activity} parsed={parsed} />;
  }
}
