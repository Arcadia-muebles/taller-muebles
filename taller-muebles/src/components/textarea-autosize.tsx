"use client";

import { useEffect } from "react";

export function TextareaAutosize() {
  useEffect(() => {
    const resize = (textarea: HTMLTextAreaElement) => {
      if (textarea.dataset.autosize === "off" || textarea.getClientRects().length === 0) return;

      const styles = window.getComputedStyle(textarea);
      const borderHeight = Number.parseFloat(styles.borderTopWidth) + Number.parseFloat(styles.borderBottomWidth);
      const paddingHeight = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);

      textarea.style.overflowY = "hidden";
      textarea.style.height = "0px";
      textarea.style.height = `${
        textarea.scrollHeight + (styles.boxSizing === "border-box" ? borderHeight : -paddingHeight)
      }px`;
    };

    const resizeAll = (root: ParentNode = document) => {
      root.querySelectorAll<HTMLTextAreaElement>("textarea").forEach(resize);
    };

    const handleInput = (event: Event) => {
      if (event.target instanceof HTMLTextAreaElement) resize(event.target);
    };

    const handleResize = () => resizeAll();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node instanceof HTMLTextAreaElement) resize(node);
          resizeAll(node);
        });
      });
    });

    resizeAll();
    document.fonts?.ready.then(() => resizeAll());
    document.addEventListener("input", handleInput);
    window.addEventListener("resize", handleResize);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("input", handleInput);
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
    };
  }, []);

  return null;
}
