import React from "react";

export function Badge({ variant = "default", className = "", children, ...props }) {
  let baseClasses =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";

  let variantClasses = "";

  switch (variant) {
    case "secondary":
      variantClasses = "border-transparent bg-gray-200 text-gray-800 hover:bg-gray-300";
      break;
    case "destructive":
      variantClasses = "border-transparent bg-red-500 text-white hover:bg-red-600";
      break;
    case "outline":
      variantClasses = "text-gray-900 border border-gray-300";
      break;
    default:
      variantClasses = "border-transparent bg-blue-600 text-white hover:bg-blue-700"; 
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
