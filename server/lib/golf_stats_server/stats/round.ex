defmodule GolfStatsServer.Stats.Round do
  use Ecto.Schema
  import Ecto.Changeset

  schema "rounds" do
    field(:date, :date)
    field(:course_name, :string)
    field(:total_score, :integer)
    field(:created_at, :utc_datetime)
    field(:ended_at, :utc_datetime)
    has_many(:holes, GolfStatsServer.Stats.Hole)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(round, attrs) do
    round
    |> cast(attrs, [:course_name, :date, :total_score, :created_at, :ended_at])
    |> validate_required([:course_name, :date, :total_score])
    |> cast_assoc(:holes, with: &GolfStatsServer.Stats.Hole.changeset/2)
  end
end
