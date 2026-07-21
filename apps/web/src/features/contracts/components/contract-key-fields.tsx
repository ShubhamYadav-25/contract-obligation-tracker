import { Table } from "../../../components/ui/table.js";

export function ContractKeyFields({
  fields,
}: {
  readonly fields: readonly { readonly label: string; readonly value: string }[];
}) {
  if (fields.length === 0) {
    return <p className="text-sm text-muted">No reviewed key fields are available yet.</p>;
  }

  return (
    <Table>
      <thead className="bg-surface text-xs uppercase text-muted">
        <tr>
          <th className="px-4 py-3">Field</th>
          <th className="px-4 py-3">Value</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {fields.map((field) => (
          <tr key={field.label}>
            <td className="px-4 py-3 font-medium">{field.label}</td>
            <td className="px-4 py-3">{field.value}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
