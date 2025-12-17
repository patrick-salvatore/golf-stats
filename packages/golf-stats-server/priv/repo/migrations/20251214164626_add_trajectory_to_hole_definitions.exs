defmodule GolfStatsServer.Repo.Migrations.AddTrajectoryToHoleDefinitions do
  use Ecto.Migration

  def change do
    alter table(:hole_definitions) do
      add(:trajectory, :map)
    end
  end
end
