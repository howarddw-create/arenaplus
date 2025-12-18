export function showToast(message: string) {
  let container = document.getElementById("cash-machine-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "cash-machine-toast-container";
    Object.assign(container.style, {
      position: "fixed",
      bottom: "24px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      flexDirection: "column-reverse",
      alignItems: "center",
      gap: "10px",
      zIndex: "2147483647",
    });
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.style.background = "linear-gradient(to right, #8b5cf6, #6d28d9)";
  toast.style.color = "white";
  toast.style.padding = "12px 24px";
  toast.style.borderRadius = "12px";
  toast.style.fontWeight = "600";
  toast.style.boxShadow =
    "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)";
  toast.style.opacity = "0";
  toast.style.transform = "translateY(20px) scale(0.95)";
  toast.style.transition = "all 300ms cubic-bezier(0.4, 0, 0.2, 1)";
  toast.textContent = message;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0) scale(1)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px) scale(0.95)";
    toast.addEventListener("transitionend", (event) => {
      if (event.propertyName === "opacity") {
        toast.remove();
        if (container && !container.hasChildNodes()) {
          container.remove();
        }
      }
    });
  }, 3000);
}
