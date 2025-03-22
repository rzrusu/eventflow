declare module '../pages/StoryEditor.jsx' {
  const StoryEditor: React.ComponentType;
  export default StoryEditor;
}

declare module '../components/StoryFlow.jsx' {
  interface StoryFlowProps {
    storylineId: string;
  }
  const StoryFlow: React.ComponentType<StoryFlowProps>;
  export default StoryFlow;
} 