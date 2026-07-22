const fs = require('fs');
let content = fs.readFileSync('src/pages/About.tsx', 'utf8');

// Replace static timelineEvents mapping with dynamic one
content = content.replace(
  "export default function About() {",
  "export default function About() {\n  const { data: profile } = useProfile();\n  const eventsToRender = (profile?.journey_events && profile.journey_events.length > 0) ? profile.journey_events : timelineEvents;"
);

content = content.replace(
  "timelineEvents.map((event, index)",
  "eventsToRender.map((event: any, index: number)"
);

// We need to import useProfile
content = content.replace(
  "import { useAbout } from \"@/hooks/useApi\";",
  "import { useAbout, useProfile } from \"@/hooks/useApi\";"
);

fs.writeFileSync('src/pages/About.tsx', content);
