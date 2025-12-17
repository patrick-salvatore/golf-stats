defmodule GolfStatsServer.Repo.Migrations.CreateRounds do
  use Ecto.Migration

  def change do
    create table(:rounds) do
      add :course_name, :string
      add :date, :date
      add :total_score, :integer

      timestamps(type: :utc_datetime)
    end
  end
end
