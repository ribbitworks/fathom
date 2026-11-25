// SPDX-License-Identifier: Apache-2.0

// The pages' shared styles, from the files they are kept in by what they style. They load together,
// in this order, so where rules in two files style the same element the later file's wins, as it did
// when they were one file. The basics, in pages.module.css, come first; pages import them directly.

import "./pages.module.css";
import listClasses from "./lists.module.css";
import cellClasses from "./cells.module.css";
import recordTableClasses from "./record-tables.module.css";
import changeWordClasses from "./change-words.module.css";
import timelineClasses from "./timelines.module.css";

export {
  cellClasses,
  changeWordClasses,
  listClasses,
  recordTableClasses,
  timelineClasses,
};
