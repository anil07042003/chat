const Spinner = ({ size = "md", className = "" }) => {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-3",
    xl: "w-12 h-12 border-4",
  };

  return (
    <div
      className={`${sizeClasses[size]} border-nexchat-600 border-t-transparent rounded-full animate-spin ${className}`}
    />
  );
};

export const LoadingScreen = ({ message = "Loading..." }) => (
  <div className="flex flex-col items-center justify-center h-full gap-4">
    <div className="relative">
      <div className="w-16 h-16 rounded-2xl bg-nexchat-600/20 flex items-center justify-center">
        <span className="text-3xl">💬</span>
      </div>
      <div className="absolute -bottom-1 -right-1">
        <Spinner size="sm" />
      </div>
    </div>
    <p className="text-surface-400 text-sm">{message}</p>
  </div>
);

export default Spinner;
