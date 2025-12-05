defmodule GolfStatsServer.Bag.Club do
  use Ecto.Schema
  import Ecto.Changeset

  schema "clubs" do
    field :name, :string
    field :type, :string

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(club, attrs) do
    club
    |> cast(attrs, [:name, :type])
    |> validate_required([:name, :type])
  end
end
