import { type FC, type HTMLAttributes, type PropsWithChildren } from 'react';
import { cn } from '../../../lib/utils';
import { SectionHeader } from '../SectionHeader';

export const Panel: FC<PropsWithChildren<HTMLAttributes<HTMLDivElement>>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn('bg-white border border-gray-200 rounded-lg shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  );
};

export const PanelHeader: FC<{ title: string }> = ({ title }) => {
  return (
    <div className="p-4 border-b border-gray-200">
      <SectionHeader title={title} />
    </div>
  );
};

export const PanelContent: FC<PropsWithChildren<HTMLAttributes<HTMLDivElement>>> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn('p-4', className)} {...props}>
      {children}
    </div>
  );
};
