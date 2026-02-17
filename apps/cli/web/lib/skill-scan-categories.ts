import type { SkillScanCategoryId } from "@safeclaw/shared";

export interface SkillScanCategoryMeta {
  name: string;
  shortName: string;
  color: string;
}

export const SKILL_SCAN_CATEGORIES: Record<SkillScanCategoryId, SkillScanCategoryMeta> = {
  "SK-HID": { name: "Hidden Content", shortName: "Hidden", color: "text-red-400" },
  "SK-INJ": { name: "Prompt Injection", shortName: "Injection", color: "text-red-400" },
  "SK-EXE": { name: "Shell Execution", shortName: "Exec", color: "text-red-400" },
  "SK-EXF": { name: "Data Exfiltration", shortName: "Exfil", color: "text-orange-400" },
  "SK-SEC": { name: "Embedded Secrets", shortName: "Secrets", color: "text-red-400" },
  "SK-SFA": { name: "Sensitive File Refs", shortName: "Files", color: "text-orange-400" },
  "SK-MEM": { name: "Memory/Config Poisoning", shortName: "Memory", color: "text-red-400" },
  "SK-SUP": { name: "Supply Chain Risk", shortName: "Supply", color: "text-orange-400" },
  "SK-B64": { name: "Encoded Payloads", shortName: "Encoded", color: "text-orange-400" },
  "SK-IMG": { name: "Image Exfiltration", shortName: "Image", color: "text-red-400" },
  "SK-SYS": { name: "System Prompt Extraction", shortName: "SysPrompt", color: "text-orange-400" },
  "SK-ARG": { name: "Argument Injection", shortName: "ArgInj", color: "text-red-400" },
  "SK-XTL": { name: "Cross-Tool Chaining", shortName: "XTool", color: "text-orange-400" },
  "SK-PRM": { name: "Excessive Permissions", shortName: "Perms", color: "text-orange-400" },
  "SK-STR": { name: "Suspicious Structure", shortName: "Structure", color: "text-yellow-400" },
};
