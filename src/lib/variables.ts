/**
 * Centralized variable resolution for BMad step files and paths.
 *
 * Reads _bmad/config.yaml for user customizations, overlays state-derived values,
 * and provides a single function for resolving {var} and {{var}} placeholders.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { BmadState } from "../types.ts";

/**
 * Default variable values — used when config.yaml is missing or incomplete.
 */
const DEFAULTS: Record<string, string> = {
  user_name: "User",
  communication_language: "vietnamese",
  document_output_language: "vietnamese",
  user_skill_level: "expert",
  output_folder: "_bmad-output",
};

/**
 * Build the full variable resolution map for step content and paths.
 *
 * Priority: state-derived values > config.yaml > defaults.
 */
export async function buildVariables(
  projectPath: string,
  state: BmadState
): Promise<Record<string, string>> {
  // Start with defaults
  const vars: Record<string, string> = { ...DEFAULTS };

  // Try to read config.yaml for user customizations
  const configPath = join(projectPath, "_bmad", "config.yaml");
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = parseYaml(raw);
    if (parsed && typeof parsed === "object") {
      for (const [key, value] of Object.entries(
        parsed as Record<string, unknown>
      )) {
        if (typeof value === "string") {
          vars[key] = value;
        }
      }
    }
  } catch {
    // config.yaml doesn't exist yet — use defaults
  }

  // State-derived values (always override config)
  vars["project-root"] = projectPath;
  vars["project_name"] = state.projectName;

  // Computed paths (use config values if present, otherwise derive)
  const outputFolder = vars["output_folder"] ?? "_bmad-output";
  if (!vars["planning_artifacts"]) {
    vars["planning_artifacts"] = join(
      projectPath,
      outputFolder,
      "planning-artifacts"
    );
  }
  if (!vars["implementation_artifacts"]) {
    vars["implementation_artifacts"] = join(
      projectPath,
      outputFolder,
      "implementation-artifacts"
    );
  }
  if (!vars["product_knowledge"]) {
    vars["product_knowledge"] = join(projectPath, "docs");
  }

  // Date variable — YYYY-MM-DD
  vars["date"] = new Date().toISOString().slice(0, 10);

  return vars;
}

/**
 * Resolve all {{var}} and {var} placeholders in a string.
 * Handles both single-brace and double-brace patterns used in BMad step files.
 */
export function resolveVariables(
  text: string,
  vars: Record<string, string>
): string {
  let resolved = text;
  for (const [key, value] of Object.entries(vars)) {
    // Double-brace first (more specific), then single-brace
    resolved = resolved.replaceAll(`{{${key}}}`, value);
    resolved = resolved.replaceAll(`{${key}}`, value);
  }
  return resolved;
}
