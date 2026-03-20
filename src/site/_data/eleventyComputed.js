const { getGraph } = require("../../helpers/linkUtils");
const { getFileTree } = require("../../helpers/filetreeUtils");
const { userComputed } = require("../../helpers/userUtils");

function getRecentNotes(data, limit = 3) {
  return (data.collections.note || [])
    .filter((note) => note.data.created && (!note.data.tags || !note.data.tags.includes("gardenEntry")))
    .sort((a, b) => new Date(b.data.created) - new Date(a.data.created))
    .slice(0, limit)
    .map((note) => ({
      title: note.data.title || note.fileSlug,
      url: note.data.permalink || note.url,
      created: note.data.created,
      description: note.data.metatags?.description || null,
    }));
}

module.exports = {
  graph: async (data) => await getGraph(data),
  filetree: (data) => getFileTree(data),
  recentNotes: (data) => getRecentNotes(data),
  userComputed: (data) => userComputed(data)
};
