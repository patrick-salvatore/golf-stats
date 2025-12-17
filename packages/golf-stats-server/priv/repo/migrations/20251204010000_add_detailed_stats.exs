defmodule GolfStatsServer.Repo.Migrations.AddDetailedStats do
  use Ecto.Migration

  def change do
    alter table(:holes) do
      # "hit", "left", "right"
      add(:fairway_status, :string)
      # "hit", "short", "long", "left", "right"
      add(:gir_status, :string)
      add(:fairway_bunker, :boolean, default: false)
      add(:greenside_bunker, :boolean, default: false)
      # in feet
      add(:proximity_to_hole, :integer)
    end
  end
end
