import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildVariables, resolveVariables } from "../lib/variables.ts";
import { createInitialState } from "../lib/state.ts";

describe("resolveVariables", () => {
  it("replaces {var} placeholders", () => {
    const result = resolveVariables("Hello {user_name}!", {
      user_name: "Alice",
    });
    expect(result).toBe("Hello Alice!");
  });

  it("replaces {{var}} placeholders", () => {
    const result = resolveVariables("Date: {{date}}", {
      date: "2026-03-01",
    });
    expect(result).toBe("Date: 2026-03-01");
  });

  it("handles both {var} and {{var}} in the same string", () => {
    const result = resolveVariables(
      "Path: {project-root}/output/{{project_name}}-{{date}}.md",
      {
        "project-root": "/home/user/project",
        project_name: "MyApp",
        date: "2026-03-01",
      }
    );
    expect(result).toBe(
      "Path: /home/user/project/output/MyApp-2026-03-01.md"
    );
  });

  it("leaves unmatched placeholders unchanged", () => {
    const result = resolveVariables("Value: {unknown_var}", {});
    expect(result).toBe("Value: {unknown_var}");
  });

  it("handles empty string", () => {
    expect(resolveVariables("", { foo: "bar" })).toBe("");
  });
});

describe("buildVariables", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bmad-vars-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns default values when no config.yaml exists", async () => {
    const state = createInitialState(tempDir, "TestProject");
    const vars = await buildVariables(tempDir, state);

    expect(vars["project-root"]).toBe(tempDir);
    expect(vars["project_name"]).toBe("TestProject");
    expect(vars["user_name"]).toBe("User");
    expect(vars["user_skill_level"]).toBe("expert");
    expect(vars["communication_language"]).toBe("english");
    expect(vars["output_folder"]).toBe("_bmad-output");
  });

  it("includes a date variable in YYYY-MM-DD format", async () => {
    const state = createInitialState(tempDir, "TestProject");
    const vars = await buildVariables(tempDir, state);

    expect(vars["date"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("computes planning_artifacts and implementation_artifacts paths", async () => {
    const state = createInitialState(tempDir, "TestProject");
    const vars = await buildVariables(tempDir, state);

    expect(vars["planning_artifacts"]).toBe(
      join(tempDir, "_bmad-output", "planning-artifacts")
    );
    expect(vars["implementation_artifacts"]).toBe(
      join(tempDir, "_bmad-output", "implementation-artifacts")
    );
    expect(vars["product_knowledge"]).toBe(join(tempDir, "docs"));
  });

  it("reads config.yaml overrides when present", async () => {
    const state = createInitialState(tempDir, "TestProject");
    await mkdir(join(tempDir, "_bmad"), { recursive: true });
    await writeFile(
      join(tempDir, "_bmad", "config.yaml"),
      [
        'project_name: "TestProject"',
        'user_name: "Alice"',
        'user_skill_level: "beginner"',
        'communication_language: "vietnamese"',
      ].join("\n"),
      "utf-8"
    );

    const vars = await buildVariables(tempDir, state);

    // Config overrides should be applied
    expect(vars["user_name"]).toBe("Alice");
    expect(vars["user_skill_level"]).toBe("beginner");
    expect(vars["communication_language"]).toBe("vietnamese");
    // State-derived values always override config
    expect(vars["project_name"]).toBe("TestProject");
  });

  it("state-derived project-root always overrides config", async () => {
    const state = createInitialState(tempDir, "MyProject");
    await mkdir(join(tempDir, "_bmad"), { recursive: true });
    await writeFile(
      join(tempDir, "_bmad", "config.yaml"),
      'project-root: "/wrong/path"\n',
      "utf-8"
    );

    const vars = await buildVariables(tempDir, state);

    // State-derived value should win
    expect(vars["project-root"]).toBe(tempDir);
  });
});
