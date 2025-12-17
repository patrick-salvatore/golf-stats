defmodule GolfStatsServer.Repo.Migrations.CreateHoleDefinitions do
  use Ecto.Migration

  def change do
    create table(:hole_definitions) do
      add(:hole_number, :integer)
      add(:par, :integer)
      add(:handicap, :integer)
      add(:lat, :float)
      add(:lng, :float)
      add(:hazards, :map)
      add(:course_id, references(:courses, on_delete: :delete_all))

      timestamps(type: :utc_datetime)
    end

    create(index(:hole_definitions, [:course_id]))
  end
end
