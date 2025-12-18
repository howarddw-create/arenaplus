import React from 'react';

interface IconButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  title?: string;
  className?: string;
  ariaLabel?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  onClick,
  icon,
  title,
  className = 'text-blue-600 hover:text-blue-800',
  ariaLabel
}) => {
  return (
    <button
      onClick={onClick}
      className={className}
      title={title}
      aria-label={ariaLabel}
    >
      {icon}
    </button>
  );
};
