/** Web and the desktop app: picks a PNG with a file input and reads it as base64. Null when the player cancels. */
export function pickPng(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png";
    input.style.display = "none";
    let settled = false;
    const finish = (value: string | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      input.remove();
      if (error) reject(error);
      else resolve(value);
    };
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      const reader = new FileReader();
      reader.onload = () => finish(String(reader.result ?? "").replace(/^data:[^,]*,/, ""));
      reader.onerror = () => finish(null, reader.error);
      reader.readAsDataURL(file);
    });
    // Closing the dialog without a file fires "cancel" in current browsers.
    input.addEventListener("cancel", () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}
