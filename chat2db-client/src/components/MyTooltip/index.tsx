import React from 'react';
import styles from './index.less';
import { Tooltip } from 'antd';
import cs from 'classnames';
import { TooltipPropsWithTitle } from 'antd/es/tooltip';

interface IProps extends TooltipPropsWithTitle {
  children: React.ReactNode;
  className?: string;
}

function MyTooltip(props: IProps) {
  const { title, color, children, className } = props;
  return title ? (
    <Tooltip
      {...props}
      color={color || window._AppThemePack.colorBgBase}
      className={cs(className, styles.myTooltip)}
      title={title}
    >
      {children}
    </Tooltip>
  ) : null;
}

export default MyTooltip;
