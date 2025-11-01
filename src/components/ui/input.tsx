import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, icon, id, inputProps, ...props }, ref) => {
    const inputId = id || `input-${React.useId()}`
    const [isFocused, setIsFocused] = React.useState(false)
    const [hasValue, setHasValue] = React.useState(!!props.defaultValue)

    React.useEffect(() => {
      setHasValue(Boolean(!!props.value || props.defaultValue))
    }, [props.value, props.defaultValue])

    return (
      <div className="relative w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "absolute left-3 transition-all-300 pointer-events-none z-10 bg-gray-800 px-1",
              isFocused || hasValue
                ? "text-xs text-exa-primary -top-2 left-3"
                : "text-base text-gray-400 top-3.5",
              error && "text-red-500"
            )}
          >
            {label}
          </label>
        )}

        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10">
            {icon}
          </div>
        )}

        <input
          type={type}
          id={inputId}
          className={cn(
            "flex h-12 w-full rounded-xl border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white transition-all-300 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-exa-primary focus-visible:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-50",
            icon && "pl-10",
            (isFocused || hasValue) && label && "pt-6",
            error && "border-red-500 focus-visible:ring-red-500",
            className
          )}
          ref={ref}
          onFocus={(e) => {
            setIsFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            props.onBlur?.(e)
          }}
          {...props}
          {...inputProps}
        />

        {error && (
          <p className="mt-1 text-xs text-red-500">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }