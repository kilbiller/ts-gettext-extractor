import * as fs from "node:fs";
import path from "node:path";
import * as parser from "@babel/parser";
import _traverse from "@babel/traverse";
import { ArgumentPlaceholder, SpreadElement, Expression } from "@babel/types";
const traverse = (_traverse as any).default as typeof _traverse;

const findAllTSFiles = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = entries.flatMap((entry) => {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      return findAllTSFiles(res);
    } else if (
      entry.isFile() &&
      (res.endsWith(".ts") || res.endsWith(".tsx"))
    ) {
      return [res];
    } else {
      return [];
    }
  });
  return files;
};

type TranslationLocation = { file: string; line: number };
type TranslationEntry =
  | { type: "singular"; locations: TranslationLocation[] }
  | {
      type: "plural";
      singular: string;
      plural: string;
      locations: TranslationLocation[];
    };

const extractLiteralValue = (
  node: ArgumentPlaceholder | SpreadElement | Expression | undefined
): string | null => {
  if (!node) return null;
  if (node.type === "StringLiteral") return node.value;
  if (node.type === "TemplateLiteral") {
    return node.quasis.map((q) => q.value.raw).join("");
  }
  return null;
};

const translations = new Map<string, TranslationEntry>();

const extractTranslationsFromFile = (filePath: string) => {
  const code = fs.readFileSync(filePath, "utf8");

  // Parse the code using Babel Parser with source maps (for loc)
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["typescript"],
    ranges: true, // This ensures that Babel keeps track of the position of each node
  });

  // Traverse the AST to find translation function calls
  traverse(ast, {
    CallExpression({ node }) {
      const callee = node.callee;
      if (callee.type !== "Identifier") return;

      const fnName = callee.name;
      const loc = node.loc?.start;
      if (!loc) return;

      const location: TranslationLocation = {
        file: filePath,
        line: loc.line,
      };

      if (fnName === "__" && node.arguments.length >= 1) {
        const arg = node.arguments[0];
        const msgid = extractLiteralValue(arg);
        if (msgid) {
          const entry = translations.get(msgid);
          if (entry && entry.type === "singular") {
            entry.locations.push(location);
          } else {
            translations.set(msgid, {
              type: "singular",
              locations: [location],
            });
          }
        }
      }

      if (fnName === "__n" && node.arguments.length >= 2) {
        const singular = extractLiteralValue(node.arguments[0]);
        const plural = extractLiteralValue(node.arguments[1]);
        if (singular && plural) {
          const key = `${singular}|${plural}`;
          const existing = translations.get(key);
          if (existing && existing.type === "plural") {
            existing.locations.push(location);
          } else {
            translations.set(key, {
              type: "plural",
              singular,
              plural,
              locations: [location],
            });
          }
        }
      }
    },
  });
};

const escapePO = (str: string): string => {
  return str.replace(/"/g, '\\"');
};

const generatePO = (): string => {
  const header = `
msgid ""
msgstr ""
"Project-Id-Version: InvitYou V2.2\\n"
"POT-Creation-Date: ${new Date().toISOString()}\\n"
"Language-Team: InvitYou <contact@invityou.com>\\n"
"Language: en\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
`;

  let output = header + "\n";

  for (const [key, entry] of translations.entries()) {
    const locationLines = entry.locations
      .map((loc) => `#: ${path.relative(process.cwd(), loc.file)}`)
      .join("\n");

    output += locationLines + "\n";

    if (entry.type === "singular") {
      output += `msgid "${escapePO(key)}"\n`;
      output += `msgstr ""\n`;
    }

    if (entry.type === "plural") {
      output += `msgid "${escapePO(entry.singular)}"\n`;
      output += `msgid_plural "${escapePO(entry.plural)}"\n`;
      output += `msgstr[0] ""\n`;
      output += `msgstr[1] ""\n`;
    }

    output += `\n`;
  }

  return output;
};

const tsFiles = findAllTSFiles(path.join(process.cwd(), "tests"));

for (const file of tsFiles) {
  extractTranslationsFromFile(file);
}

const poContent = generatePO();

fs.writeFileSync("translations.po", poContent);
console.log("✅ Translations written to translations.po");
