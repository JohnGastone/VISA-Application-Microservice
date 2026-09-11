interface Entity {
  name: string;
  x: number;
  y: number;
  fields: { name: string; key?: "PK" | "FK" | "UQ" }[];
}

const ROW_HEIGHT = 19;
const HEADER_HEIGHT = 30;
const WIDTH = 232;

const ENTITIES: Entity[] = [
  {
    name: "applicant",
    x: 14,
    y: 150,
    fields: [
      { name: "id", key: "PK" },
      { name: "fullname" },
      { name: "passport_number", key: "UQ" },
      { name: "country" },
      { name: "gender" },
      { name: "phone" },
      { name: "email" },
    ],
  },
  {
    name: "visa_application",
    x: 334,
    y: 120,
    fields: [
      { name: "id", key: "PK" },
      { name: "applicant_id", key: "FK" },
      { name: "application_date" },
      { name: "visa_type" },
      { name: "expire_date" },
      { name: "status" },
    ],
  },
  {
    name: "background_check",
    x: 654,
    y: 14,
    fields: [
      { name: "id", key: "PK" },
      { name: "application_id", key: "FK" },
      { name: "status" },
      { name: "remarks" },
      { name: "check_date" },
      { name: "checked_by" },
    ],
  },
  {
    name: "payment_trxn",
    x: 654,
    y: 200,
    fields: [
      { name: "id", key: "PK" },
      { name: "application_id", key: "FK" },
      { name: "payment_reference", key: "UQ" },
      { name: "amount" },
      { name: "payment_status" },
      { name: "payment_date" },
    ],
  },
  {
    name: "application_event",
    x: 334,
    y: 350,
    fields: [
      { name: "id", key: "PK" },
      { name: "application_id", key: "FK" },
      { name: "type" },
      { name: "message" },
      { name: "created_at" },
    ],
  },
];

function height(entity: Entity): number {
  return HEADER_HEIGHT + entity.fields.length * ROW_HEIGHT + 6;
}

const KEY_COLOR = {
  PK: "#0f766e",
  FK: "#7c3aed",
  UQ: "#b45309",
} as const;

/**
 * Hand-laid ERD. Drawn as inline SVG so it stays crisp, themeable and
 * copy-pasteable into the submission document.
 */
export function Erd() {
  const boxes = new Map(ENTITIES.map((entity) => [entity.name, entity]));
  const application = boxes.get("visa_application")!;

  const relations = [
    {
      from: boxes.get("applicant")!,
      to: application,
      label: "1 : N",
      path: `M ${14 + WIDTH} 225 H 300 V 195 H ${application.x}`,
    },
    {
      from: application,
      to: boxes.get("background_check")!,
      label: "1 : 1",
      path: `M ${application.x + WIDTH} 175 H 620 V 95 H 654`,
    },
    {
      from: application,
      to: boxes.get("payment_trxn")!,
      label: "1 : N",
      path: `M ${application.x + WIDTH} 215 H 620 V 285 H 654`,
    },
    {
      from: application,
      to: boxes.get("application_event")!,
      label: "1 : N",
      path: `M 450 ${application.y + height(application)} V 350`,
    },
  ];

  return (
    <svg
      viewBox="0 0 900 505"
      className="h-auto w-full min-w-2xl"
      role="img"
      aria-label="Entity relationship diagram: applicant one-to-many visa_application; visa_application one-to-one background_check; visa_application one-to-many payment_trxn and application_event."
    >
      {relations.map((relation) => (
        <path
          key={`${relation.from.name}-${relation.to.name}`}
          d={relation.path}
          fill="none"
          stroke="var(--border)"
          strokeWidth={2}
        />
      ))}

      {relations.map((relation, index) => {
        const positions = [
          { x: 300, y: 186 },
          { x: 624, y: 88 },
          { x: 624, y: 278 },
          { x: 458, y: 340 },
        ][index];
        return (
          <text
            key={`label-${index}`}
            x={positions.x}
            y={positions.y}
            fontSize="11"
            fontWeight="600"
            fill="var(--muted)"
          >
            {relation.label}
          </text>
        );
      })}

      {ENTITIES.map((entity) => (
        <g key={entity.name}>
          <rect
            x={entity.x}
            y={entity.y}
            width={WIDTH}
            height={height(entity)}
            rx={10}
            fill="var(--surface)"
            stroke="var(--border)"
            strokeWidth={1.5}
          />
          <rect
            x={entity.x}
            y={entity.y}
            width={WIDTH}
            height={HEADER_HEIGHT}
            rx={10}
            fill="var(--accent)"
          />
          <rect
            x={entity.x}
            y={entity.y + HEADER_HEIGHT - 10}
            width={WIDTH}
            height={10}
            fill="var(--accent)"
          />
          <text
            x={entity.x + 12}
            y={entity.y + 20}
            fontSize="12.5"
            fontWeight="700"
            fill="var(--accent-contrast)"
            fontFamily="var(--font-geist-mono), monospace"
          >
            {entity.name}
          </text>

          {entity.fields.map((field, index) => (
            <g key={field.name}>
              <text
                x={entity.x + 12}
                y={entity.y + HEADER_HEIGHT + 14 + index * ROW_HEIGHT}
                fontSize="11.5"
                fill="var(--foreground)"
                fontFamily="var(--font-geist-mono), monospace"
              >
                {field.name}
              </text>
              {field.key ? (
                <text
                  x={entity.x + WIDTH - 12}
                  y={entity.y + HEADER_HEIGHT + 14 + index * ROW_HEIGHT}
                  fontSize="10"
                  fontWeight="700"
                  textAnchor="end"
                  fill={KEY_COLOR[field.key]}
                  fontFamily="var(--font-geist-mono), monospace"
                >
                  {field.key}
                </text>
              ) : null}
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}
