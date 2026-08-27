// MDX の書式をここで一度だけ決める。Next はこの位置の useMDXComponents を拾う。
import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: (props) => <h2 className="news__h2" {...props} />,
    p: (props) => <p className="news__p" {...props} />,
    ul: (props) => <ul className="news__ul" {...props} />,
    ...components,
  };
}
