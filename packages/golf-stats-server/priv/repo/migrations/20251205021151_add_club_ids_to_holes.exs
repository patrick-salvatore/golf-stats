defmodule GolfStatsServer.Repo.Migrations.AddClubIdsToHoles do
  use Ecto.Migration

  def change do
    alter table(:holes) do
      add(:club_ids, {:array, :integer}, default: [])
    end
  end
end
