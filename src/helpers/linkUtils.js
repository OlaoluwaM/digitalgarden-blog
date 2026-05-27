const wikiLinkRegex = /\[\[(.*?\|.*?)\]\]/g;
const internalLinkRegex = /href="\/(.*?)"/g;
// Match iframe src for canvas embedded files (internal links only, not external URLs)
// Format: <iframe src="/path/" class="canvas-file-iframe" ...>
// Use non-greedy [^>]*? to avoid over-matching
const iframeSrcRegex = /<iframe[^>]*?src="(\/[^"#]*)"[^>]*?class="canvas-file-iframe"/g;
// Match ```base code blocks to extract links from bases queries.
const basesBlockRegex = /```base[^\n\r]*\r?\n([\s\S]*?)```/g;

let basesEngine = null;
let clearRenderCache = null;
try {
  basesEngine = require("./bases-engine");
  clearRenderCache = require("./basesPlugin").clearRenderCache;
} catch {
  // Bases support is optional so link extraction can still run without it.
}

function extractLinks(content) {
  // Extract iframe sources for canvas embeds
  const iframeLinks = [];
  let match;
  while ((match = iframeSrcRegex.exec(content)) !== null) {
    // match[1] is the captured path like "/notes/some-page/"
    iframeLinks.push(match[1]);
  }
  // Reset regex lastIndex for next use
  iframeSrcRegex.lastIndex = 0;

  return [
    ...(content.match(wikiLinkRegex) || []).map(
      (link) =>
        link
          .slice(2, -2)
          .split("|")[0]
          .replace(/\.(md|markdown)\s?$/i, "")
          .replace("\\", "")
          .trim()
          .split("#")[0]
    ),
    ...(content.match(internalLinkRegex) || []).map(
      (link) =>
        link
          .slice(6, -1)
          .split("|")[0]
          // Don't strip .canvas - canvas URLs actually include it
          .replace(/\.(md|markdown)\s?$/i, "")
          .replace("\\", "")
          .trim()
          .split("#")[0]
    ),
    ...iframeLinks,
  ];
}

// Cache bases query results, keyed by YAML content. Built once per build.
const basesQueryCache = new Map();

function extractBasesLinks(content, basesNotes) {
  if (!basesEngine) return [];

  const links = [];
  let match;
  basesBlockRegex.lastIndex = 0;
  while ((match = basesBlockRegex.exec(content)) !== null) {
    const yamlContent = match[1];

    if (!basesQueryCache.has(yamlContent)) {
      try {
        const result = basesEngine.executeBaseQuery(yamlContent, basesNotes);
        const urls = [];
        for (const view of result.views) {
          for (const row of view.rows) {
            if (row.url) urls.push(row.url);
          }
        }
        basesQueryCache.set(yamlContent, urls);
      } catch {
        basesQueryCache.set(yamlContent, []);
      }
    }

    links.push(...basesQueryCache.get(yamlContent));
  }
  return links;
}

async function getGraph(data) {
  let nodes = {};
  let links = [];
  let stemURLs = {};
  let homeAlias = "/";

  // Process notes sequentially to handle async reads
  const notes = data.collections.note || [];
  const noteContents = [];

  // Clear caches from any previous build, which matters in --watch mode.
  basesQueryCache.clear();
  if (clearRenderCache) clearRenderCache();

  for (let idx = 0; idx < notes.length; idx++) {
    const v = notes[idx];
    let fpath = v.filePathStem.replace("/notes/", "");
    let parts = fpath.split("/");
    let group = "none";
    if (parts.length >= 3) {
      group = parts[parts.length - 2];
    }

    // Use async read() method instead of accessing frontMatter directly
    const templateContent = await v.template.read();
    const content = templateContent?.content || "";
    noteContents.push(content);

    nodes[v.url] = {
      id: idx,
      title: v.data.title || v.fileSlug,
      url: v.url,
      group,
      home:
        v.data["dg-home"] ||
        (v.data.tags && v.data.tags.indexOf("gardenEntry") > -1) ||
        false,
      outBound: extractLinks(content),
      neighbors: new Set(),
      backLinks: new Set(),
      noteIcon: v.data.noteIcon || process.env.NOTE_ICON_DEFAULT,
      hide: v.data.hideInGraph || false,
    };
    stemURLs[fpath] = v.url;
    if (
      v.data["dg-home"] ||
      (v.data.tags && v.data.tags.indexOf("gardenEntry") > -1)
    ) {
      homeAlias = v.url;
    }
  }
  Object.values(nodes).forEach((node) => {
    let outBound = new Set();
    node.outBound.forEach((olink) => {
      let link = (stemURLs[olink] || olink).split("#")[0];
      outBound.add(link);
    });
    node.outBound = Array.from(outBound);
    node.outBound.forEach((link) => {
      let n = nodes[link];
      if (n) {
        n.neighbors.add(node.url);
        n.backLinks.add(node.url);
        node.neighbors.add(n.url);
        links.push({ source: node.id, target: n.id });
      }
    });
  });
  Object.keys(nodes).map((k) => {
    nodes[k].neighbors = Array.from(nodes[k].neighbors);
    nodes[k].backLinks = Array.from(nodes[k].backLinks);
    nodes[k].size = nodes[k].neighbors.length;
  });

  const basesNotes = notes.map((item) => {
    const node = nodes[item.url] || {};
    return {
      path: item.filePathStem.replace("/notes/", ""),
      url: item.url,
      metadata: item.data,
      fileSlug: item.fileSlug,
      _links: node.outBound || [],
      _backlinks: node.backLinks || [],
    };
  });

  for (let idx = 0; idx < notes.length; idx++) {
    const node = nodes[notes[idx].url];
    const basesLinks = extractBasesLinks(noteContents[idx], basesNotes);
    for (const link of basesLinks) {
      if (node.outBound.includes(link)) continue;
      node.outBound.push(link);
      const linkedNode = nodes[link];
      if (linkedNode) {
        if (!linkedNode.backLinks.includes(node.url)) linkedNode.backLinks.push(node.url);
        if (!linkedNode.neighbors.includes(node.url)) linkedNode.neighbors.push(node.url);
        if (!node.neighbors.includes(link)) node.neighbors.push(link);
        links.push({ source: node.id, target: linkedNode.id });
      }
    }
    node.size = node.neighbors.length;
  }

  exports._basesNotesWithLinks = basesNotes;

  return {
    homeAlias,
    nodes,
    links,
  };
}

exports.wikiLinkRegex = wikiLinkRegex;
exports.internalLinkRegex = internalLinkRegex;
exports.extractLinks = extractLinks;
exports.getGraph = getGraph;
exports._basesNotesWithLinks = null;
