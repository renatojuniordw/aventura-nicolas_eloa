import type { ButtonHTMLAttributes, ReactNode } from 'react';

type MenuButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type' | 'tabIndex'> & {
  onClick?: () => void | Promise<void>;
  children?: ReactNode;
};

/** Native focus and activation coexist with the abstracted game controls. */
export function MenuButton({ onClick, children, ...rest }: MenuButtonProps) {
  return (
    <button {...rest} type="button" onClick={onClick}>
      {children}
    </button>
  );
}
