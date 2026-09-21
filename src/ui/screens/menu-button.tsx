import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { blurOnClick } from './mount-screen.js';

type MenuButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type' | 'tabIndex'> & {
  onClick?: () => void | Promise<void>;
  children?: ReactNode;
};

/**
 * The button every overlay screen uses. It stays out of the tab order and
 * blurs itself on click (see `blurOnClick`), so keyboard focus remains on the
 * game surface — menus are driven by the abstracted CONFIRM/BACK actions, not
 * by DOM focus.
 */
export function MenuButton({ onClick, children, ...rest }: MenuButtonProps) {
  return (
    <button {...rest} type="button" tabIndex={-1} onClick={blurOnClick(onClick)}>
      {children}
    </button>
  );
}
