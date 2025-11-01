import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useTheme } from "@/contexts/theme-context"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all-300 focus-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-exa-primary text-white hover:bg-exa-secondary hover:shadow-lg transition-colors",
        destructive: "bg-red-600 text-white hover:bg-red-700 hover:shadow-lg",
        outline: "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 hover:shadow-md",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 hover:shadow-md",
        ghost: "hover:bg-gray-100 text-gray-900 hover:shadow-sm",
        link: "text-exa-primary underline-offset-4 hover:underline hover:text-exa-secondary",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 px-4 py-2 text-sm",
        lg: "h-14 px-8 py-4 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const { theme } = useTheme()
    const Comp = asChild ? Slot : "button"

    // Apply theme-aware colors for default variant
    const getThemeClasses = () => {
      if (variant === 'default') {
        return theme === 'dark'
          ? "bg-exa-secondary text-white hover:bg-exa-primary hover:shadow-lg transition-colors"
          : "bg-exa-primary text-white hover:bg-exa-secondary hover:shadow-lg transition-colors"
      }
      if (variant === 'link') {
        return theme === 'dark'
          ? "text-exa-secondary underline-offset-4 hover:underline hover:text-exa-primary"
          : "text-exa-primary underline-offset-4 hover:underline hover:text-exa-secondary"
      }
      return ""
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), getThemeClasses())}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>{children}</span>
          </div>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }