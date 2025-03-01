export function getFileExtension(language: string): string {
  const extensions: { [key: string]: string } = {
    javascript: "js",
    python: "py",
    java: "java",
    csharp: "cs",
  };
  return extensions[language] || "txt";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function addModuleExports(content: string): any {
  const functionMatch = content.match(/function (\w+)\s*\(/);
  if (!functionMatch) {
    console.error("❌ No function found in the file.");
    return;
  }

  const functionName = functionMatch[1];

  content += `\n\nmodule.exports = {${functionName}};\n`;
  return { content, functionName };
}
