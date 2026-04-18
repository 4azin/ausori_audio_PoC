import { categoryModel, CategoryTree } from "../../models";

/** GET /api/sounds/categories — major → mid → sub 트리 */
export async function getCategoryTree(): Promise<CategoryTree[]> {
  const majors = await categoryModel.findAllMajors();
  const tree: CategoryTree[] = [];
  for (const major of majors) {
    const mids = await categoryModel.findMidsByMajor(major.id);
    const children = [];
    for (const mid of mids) {
      const subs = await categoryModel.findSubsByMid(mid.id);
      children.push({ ...mid, children: subs });
    }
    tree.push({ ...major, children });
  }
  return tree;
}
