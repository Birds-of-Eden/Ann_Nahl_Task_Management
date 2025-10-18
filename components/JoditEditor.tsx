import React, { useState, useRef, useMemo } from "react";
// import JoditEditor from "jodit-react";
import dynamic from "next/dynamic";

const JoditEditor = dynamic(() => import("jodit-react"), { ssr: false });

interface JoditEditorProps {
  placeholder?: string;
  initialValue?: string;
  onContentChange?: (content: string) => void;
  height?: string | number;
  width?: string | number;
}

const JoditEditorComponent: React.FC<JoditEditorProps> = ({
  placeholder = "Start typing...",
  initialValue = "",
  onContentChange,
  height = "400px",
  width = "100%",
}) => {
  const editor = useRef(null);
  const [content, setContent] = useState(initialValue);

  const config = useMemo(
    () => ({
      readonly: false,
      toolbar: true,
      placeholder,
      height,
    }),
    [placeholder, height]
  );

  const handleBlur = (newContent: string) => {
    setContent(newContent);
    onContentChange?.(newContent);
  };

  return (
    <div style={{ width, height }}>
      {" "}
      {/* Apply width and height to parent container */}
      <JoditEditor
        ref={editor}
        value={content}
        config={config}
        onBlur={handleBlur}
        onChange={() => {}}
      />
    </div>
  );
};

export default JoditEditorComponent;