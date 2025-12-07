defmodule GolfStatsServer.Repo.Migrations.AddCourseIdToRounds do
  use Ecto.Migration

  def change do
    alter table(:rounds) do
      add(:course_id, references(:courses, on_delete: :nothing))
    end

    create(index(:rounds, [:course_id]))
  end
end
