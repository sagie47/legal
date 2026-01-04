import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'white';
    size?: 'sm' | 'md' | 'lg';
    icon?: React.ReactNode;
};

export const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    icon,
    className = '',
    ...props
}: ButtonProps) => {
    const baseStyles = "font-medium rounded-md transition-all flex items-center justify-center gap-2 active:scale-95";

    const variants = {
        primary: "bg-black text-white hover:bg-gray-800 shadow-lg shadow-gray-200",
        secondary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-md",
        ghost: "bg-transparent text-gray-600 hover:text-black hover:bg-gray-100",
        white: "bg-white text-black border border-gray-200 hover:border-black shadow-sm"
    };

    const sizes = {
        sm: "text-xs px-3 py-1.5 h-8",
        md: "text-sm px-4 py-2 h-10",
        lg: "text-base px-6 py-3 h-12"
    };

    return (
        <button className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
            {icon && <span className="mr-1">{icon}</span>}
            {children}
        </button>
    );
};
