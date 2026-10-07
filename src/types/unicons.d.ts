declare module "@iconscout/react-unicons/icons/*" {
  import type { ComponentType, SVGProps } from "react";
  const Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number | string; color?: string }>;
  export default Icon;
}
