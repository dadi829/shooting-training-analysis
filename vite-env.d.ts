/// <reference types="vite/client" />

declare module '@ant-design/icons' {
  import { FC, SVGProps } from 'react';
  interface IconProps extends SVGProps<SVGSVGElement> {
    className?: string;
    spin?: boolean;
    rotate?: number;
    twoToneColor?: string;
  }
  type IconComponent = FC<IconProps>;
  export const DeleteOutlined: IconComponent;
  export const PictureOutlined: IconComponent;
  export const HistoryOutlined: IconComponent;
  export const ReloadOutlined: IconComponent;
  export const RobotOutlined: IconComponent;
  export const UploadOutlined: IconComponent;
  export const CheckCircleFilled: IconComponent;
  export const ThunderboltOutlined: IconComponent;
}
