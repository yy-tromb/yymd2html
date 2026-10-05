import { parseArgs } from "@std/cli/parse-args";
import { basename, dirname, extname, join } from "@std/path";
import { toString } from "mdast-util-to-string";

import rehypeStringify from "rehype-stringify";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeDocument from "rehype-document";
import rehypeCallouts from "rehype-callouts";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import rehypeFormat from "rehype-format";
import remarkRehype from "remark-rehype";

function extractTitle(
  markdown: string,
  inputPath: string,
  explicitTitle?: string,
): string {
  if (explicitTitle?.trim()) {
    return explicitTitle.trim();
  }

  const tree = remark()
    .use(remarkGfm).parse(markdown);

  const h1 = tree.children.find(
    (node) => node.type === "heading" && node.depth === 1,
  );

  if (h1) {
    const title = toString(h1).trim();

    if (title) {
      return title;
    }
  }

  const filename = basename(inputPath, extname(inputPath));

  return filename || "Document";
}

async function markdownToHtml(
  markdown: string,
  title: string,
): Promise<string> {
  const parsed = await remark()
    .use(remarkGfm)
    .use(remarkRehype, {
      allowDangerousHtml: true,
    })
    .use(rehypeRaw)
    .use(rehypeDocument, {
      title,
      css: [
        "https://unpkg.com/rehype-callouts/dist/themes/github/index.css",
        "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.3.0/css/all.min.css",
      ],
      style: `
:root {
  color-scheme: light dark;
}

body {
  color: light-dark(rgb(51 51 51), rgb(240 246 252));
  background-color: light-dark(rgb(250 250 250), rgb(13 17 23));
}

.heading-anchor {
  visibility: hidden;
  font-size: 1rem;
  margin-right: 0.3rem;
  color: light-dark(rgb(51 51 51), rgb(240 246 252));
  background-color: light-dark(rgb(250 250 250), rgb(13 17 23));
}

h1:hover .heading-anchor {
  visibility: visible;
}

h2:hover .heading-anchor {
  visibility: visible;
}

h3:hover .heading-anchor {
  visibility: visible;
}
`,
    })
    .use(rehypeCallouts, { theme: "obsidian" })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      content: {
        type: "element",
        tagName: "i",
        properties: {
          className: ["heading-anchor", "fa", "fa-link"],
        },
        children: [],
      },
    })
    .use(rehypeFormat)
    .use(rehypeStringify, {
      allowDangerousHtml: true,
    })
    .process(markdown);

  return parsed.toString();
}

function printUsage(): void {
  console.log(`
Usage:
  yymd2html <input.md>
  yymd2html <input.md> --title "Title"
  yymd2html <input.md> -o output.html

Options:
  -t, --title <title>   Override document title
  -o, --output <path>   Output HTML path
  -h, --help            Show this help
`);
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    string: ["title", "output"],
    boolean: ["help"],
    alias: {
      t: "title",
      o: "output",
      h: "help",
    },
  });

  if (args.help) {
    printUsage();
    Deno.exit(0);
  }

  if (args._.length !== 1) {
    printUsage();
    Deno.exit(1);
  }

  const inputPath = String(args._[0]);
  const markdown = await Deno.readTextFile(inputPath);

  const title = extractTitle(
    markdown,
    inputPath,
    args.title ? String(args.title) : undefined,
  );

  const html = await markdownToHtml(markdown, title);

  const outputPath = args.output ? String(args.output) : join(
    dirname(inputPath),
    `${basename(inputPath, extname(inputPath))}.html`,
  );

  await Deno.writeTextFile(outputPath, html);

  console.log(`Generated: ${outputPath}`);
}

await main();
