defmodule GolfStatsServer.Repo.Migrations.CreateHoles do
  use Ecto.Migration

  def change do
    create table(:holes) do
      add :hole_number, :integer
      add :par, :integer
      add :score, :integer
      add :fairway_hit, :boolean, default: false, null: false
      add :gir, :boolean, default: false, null: false
      add :putts, :integer
      add :round_id, references(:rounds, on_delete: :nothing)

      timestamps(type: :utc_datetime)
    end

    create index(:holes, [:round_id])
  end
end
