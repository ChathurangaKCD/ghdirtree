// read json file
import * as fs from "fs";
import * as path from "path";
import Benchmark from "benchmark";

const filename = path.join(__dirname, "../data/out.json");
console.log("read file: ", filename);
const data = fs.readFileSync(filename, "utf8");
// {
//   const obj = JSON.parse(data);
//   const start = Date.now();
//   const out1 = processFile(obj);
//   const end = Date.now();
//   console.log("Before time: ", end - start);

//   // write json file
//   const filename2 = path.join(__dirname, "../out/out2.json");
//   fs.writeFileSync(filename2, JSON.stringify(out1, null, 2));
// }
// {
//   const obj = JSON.parse(data);
//   const start = Date.now();
//   const out2 = processFile2(obj);
//   const end = Date.now();
//   console.log("New time: ", end - start);

//   // write json file
//   const filename2 = path.join(__dirname, "../out/out3.json");
//   fs.writeFileSync(filename2, JSON.stringify(out2, null, 2));
// }

var suite = new Benchmark.Suite();

const data1 = JSON.parse(data);
const data2 = JSON.parse(data);
const data3 = JSON.parse(data);

// add tests
suite
  .add("impl1", function () {
    processFile(data1);
  })
  .add("impl2", function () {
    processFile2(data2);
  })
  .add("impl3", function () {
    processFile3(data3);
  })
  // add listeners
  .on("cycle", function (event) {
    console.log(String(event.target));
  })
  .on("complete", function () {
    console.log("Fastest is " + this.filter("fastest").map("name"));
  })
  // run async
  .run({ async: true });

////////////////////////////////////////////////////////////////////

function processFile2(repositoryContent: { tree: DirectoryContent[] }) {
  if (!Array.isArray(repositoryContent.tree)) {
    return [];
  }
  const excludingFiles = [
    "md",
    "txt",
    "gitignore",
    "gitkeep",
    "LICENSE",
    "keep",
  ];
  const directories = new Map<string, DirectoryNode>();
  const files = new Map<string, DirectoryNode>();
  itemsLoop: for (const item of repositoryContent.tree) {
    // remove excluded files
    if (item.type === "blob") {
      for (const ext of excludingFiles) {
        if (item.path.endsWith(`/${ext}`)) {
          continue itemsLoop;
        }
        if (item.path.toLowerCase().endsWith(`.${ext}`)) {
          continue itemsLoop;
        }
      }
    }
    // push to directories or files
    const node: DirectoryNode = {
      path: item.path,
      subPath: item.path.split("/").pop()!,
      type: item.type,
      children: [],
    };
    if (item.type === "tree") {
      directories.set(item.path, node);
    } else {
      files.set(item.path, node);
    }
  }
  // modify the directories map items by adding children.
  // a child directory will be added to its parent directory
  // (same object is kept as children in parent directory & also in directories map)
  for (const [path, node] of directories) {
    const parent = directories.get(parentPath(path));
    if (parent) {
      parent.children.push(node);
    }
  }
  for (const [path, node] of files) {
    if (path === node.subPath) {
      // add files in the root directory
      directories.set(path, node);
    }
    // add files to their parent directory
    const parent = directories.get(parentPath(path));
    if (parent) {
      parent.children.push(node);
    }
  }
  for (const [path, node] of directories) {
    node.children.sort(compareItems);
  }
  // include only root directories. others are already included as children
  const tree = Array.from(directories.values()).filter(
    (node) => node.path == node.subPath
  );
  tree.sort(compareItems);
  return tree;
}

function compareItems(a: DirectoryNode, b: DirectoryNode) {
  if (a.type === b.type) {
    return a.subPath.localeCompare(b.subPath);
  }
  return a.type === "tree" ? -1 : 1;
}

function parentPath(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

////////////////////////////////////////////////////////////////////

function processFile3(repositoryContent: { tree: DirectoryContent[] }) {
  if (!Array.isArray(repositoryContent.tree)) {
    return [];
  }
  const excludeExtensions = new Set([
    "md",
    "txt",
    "gitignore",
    "gitkeep",
    "LICENSE",
    "keep",
  ]);
  const nodes = new Map<string, DirectoryNode>();
  repositoryContent.tree.forEach((item) => {
    const extension = item.path.split(".").pop()?.toLowerCase();
    if (
      item.type === "blob" &&
      (excludeExtensions.has(extension) || excludeExtensions.has(item.path))
    ) {
      return;
    }
    const node: DirectoryNode = {
      path: item.path,
      subPath: item.path.split("/").pop()!,
      type: item.type,
      children: [],
    };
    nodes.set(item.path, node);
  });
  // Build the tree
  nodes.forEach((node, path) => {
    const parentPath = path.substring(0, path.lastIndexOf("/"));
    if (nodes.has(parentPath)) {
      nodes.get(parentPath).children.push(node);
    }
  });
  // Sort children
  nodes.forEach((node) => {
    node.children.sort(compareItems);
  });
  // Filter root nodes and sort
  const rootNodes = Array.from(nodes.values()).filter(
    (node) => !node.path.includes("/")
  );
  rootNodes.sort(compareItems);
  return rootNodes;
}

////////////////////////////////////////////////////////////////////

function processFile(repositoryContent: { tree: DirectoryContent[] }) {
  const repositoryDirectoryContent: Pick<DirectoryContent, "type" | "path">[] =
    [];
  const excludingFiles = [
    "md",
    "txt",
    "gitignore",
    "gitkeep",
    "LICENSE",
    "keep",
  ];

  if (Array.isArray(repositoryContent.tree)) {
    repositoryContent.tree.map((item) => {
      const { path, type } = item;
      if (
        (type === "blob" && !excludingFiles.includes(path.split(".").pop()!)) ||
        type === "tree"
      )
        repositoryDirectoryContent.push({ type, path });
    });
  }
  return getRepositoryTreeStructure(repositoryDirectoryContent);
}

export class DirectoryContent {
  path: string;
  mode: string;
  type: string;
  sha: string;
  url: string;
}

export class DirectoryNode {
  path: string;
  subPath: string;
  type: string;
  children: DirectoryNode[];
}

function getRepositoryTreeStructure(
  direcotryContent: Pick<DirectoryContent, "type" | "path">[]
): DirectoryNode[] {
  let directoryTree: DirectoryNode[] = [];
  let done = false;
  let length = 0;
  let directory: null | DirectoryNode[] = null;

  while (!done) {
    length++;
    const nodes = direcotryContent
      .filter((item) => item.path.split("/").length === length)
      .map((item) => ({
        path: item.path,
        subPath: item.path.split("/").pop()!,
        type: item.type,
        children: [],
      }));
    if (nodes.length === 0) done = true;
    if (directory === null) {
      directoryTree = nodes;
    } else {
      nodes.forEach((node) => {
        const parent = directory?.find(
          (parent) =>
            parent.path === node.path.split("/").slice(0, -1).join("/")
        );
        parent?.children.push(node);
      });
    }
    directory = nodes;
  }
  sortElements(directoryTree);
  return directoryTree;
}

function sortElements(directoryData: DirectoryNode[]) {
  directoryData.sort((element1, element2) => {
    const element1IsDirectory = element1.type === "tree";
    const element2IsDirectory = element2.type === "tree";
    // Sort directories before files
    if (element1IsDirectory && !element2IsDirectory) {
      return -1;
    } else if (!element1IsDirectory && element2IsDirectory) {
      return 1;
    } else {
      return element1.subPath.localeCompare(element2.subPath); // Sort alphabetically by subPath
    }
  });

  directoryData.forEach((element) => {
    if (element.children.length > 0) {
      sortElements(element.children);
    }
  });
}
