"use client";
import { IconType } from "react-icons";
import { cn } from "@/lib/utils";
import React from "react";

export enum BUTTON_CONTENT {
  TEXT = "TEXT",
  ICON_TEXT = "ICON_TEXT",
  ICON = "ICON",
}

const BorderButton = ({
  icon,
  text,
  type = BUTTON_CONTENT.ICON_TEXT,
  onClickFunc = () => {},
  color = "black",
  className = "",
  size = 15,
}: {
  icon?: IconType;
  text?: string;
  type?: BUTTON_CONTENT;
  onClickFunc?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  color?: string;
  className?: string;
  size?: number;
}) => {
  return (
    <button
      onClick={(e) => onClickFunc(e)}
      className={cn(
        "flex items-center space-x-1 border border-slate-200 px-2 py-1 rounded-md cursor-pointer bg-white",
        className
      )}
      style={{
        color,
      }}
    >
      {icon && type != BUTTON_CONTENT.TEXT && (
        <span className="flex items-center justify-center">
          {icon && React.createElement(icon, { size: size })}
        </span>
      )}

      {text &&
        (type == BUTTON_CONTENT.ICON_TEXT || type == BUTTON_CONTENT.TEXT) && (
          <p className="text-xs font-medium">{text}</p>
        )}
    </button>
  );
};
export default BorderButton;
