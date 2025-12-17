defmodule GolfStatsServer.Repo.Migrations.CreateTeeBoxes do
  use Ecto.Migration

  def change do
    create table(:tee_boxes) do
      add(:name, :string)
      add(:color, :string)
      add(:lat, :float)
      add(:lng, :float)
      add(:yardage, :integer)
      add(:hole_definition_id, references(:hole_definitions, on_delete: :delete_all))

      timestamps(type: :utc_datetime)
    end

    create(index(:tee_boxes, [:hole_definition_id]))
  end
end
