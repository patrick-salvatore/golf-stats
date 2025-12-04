defmodule GolfStatsServer.Stats do
  @moduledoc """
  The Stats context.
  """

  import Ecto.Query, warn: false
  alias GolfStatsServer.Repo

  alias GolfStatsServer.Stats.Round

  @doc """
  Returns the list of rounds.

  ## Examples

      iex> list_rounds()
      [%Round{}, ...]

  """
  def list_rounds do
    Repo.all(Round)
  end

  @doc """
  Gets a single round.

  Raises `Ecto.NoResultsError` if the Round does not exist.

  ## Examples

      iex> get_round!(123)
      %Round{}

      iex> get_round!(456)
      ** (Ecto.NoResultsError)

  """
  def get_round!(id) do
    Round
    |> Repo.get!(id)
    |> Repo.preload(holes: [order_by: :hole_number])
  end

  @doc """
  Creates a round.

  ## Examples

      iex> create_round(%{field: value})
      {:ok, %Round{}}

      iex> create_round(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_round(attrs \\ %{}) do
    %Round{}
    |> Round.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a round.

  ## Examples

      iex> update_round(round, %{field: new_value})
      {:ok, %Round{}}

      iex> update_round(round, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_round(%Round{} = round, attrs) do
    round
    |> Round.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a round.

  ## Examples

      iex> delete_round(round)
      {:ok, %Round{}}

      iex> delete_round(round)
      {:error, %Ecto.Changeset{}}

  """
  def delete_round(%Round{} = round) do
    Repo.delete(round)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking round changes.

  ## Examples

      iex> change_round(round)
      %Ecto.Changeset{data: %Round{}}

  """
  def change_round(%Round{} = round, attrs \\ %{}) do
    Round.changeset(round, attrs)
  end

  alias GolfStatsServer.Stats.Hole

  @doc """
  Returns the list of holes.

  ## Examples

      iex> list_holes()
      [%Hole{}, ...]

  """
  def list_holes do
    Repo.all(Hole)
  end

  @doc """
  Gets a single hole.

  Raises `Ecto.NoResultsError` if the Hole does not exist.

  ## Examples

      iex> get_hole!(123)
      %Hole{}

      iex> get_hole!(456)
      ** (Ecto.NoResultsError)

  """
  def get_hole!(id), do: Repo.get!(Hole, id)

  @doc """
  Creates a hole.

  ## Examples

      iex> create_hole(%{field: value})
      {:ok, %Hole{}}

      iex> create_hole(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_hole(attrs \\ %{}) do
    %Hole{}
    |> Hole.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a hole.

  ## Examples

      iex> update_hole(hole, %{field: new_value})
      {:ok, %Hole{}}

      iex> update_hole(hole, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_hole(%Hole{} = hole, attrs) do
    hole
    |> Hole.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a hole.

  ## Examples

      iex> delete_hole(hole)
      {:ok, %Hole{}}

      iex> delete_hole(hole)
      {:error, %Ecto.Changeset{}}

  """
  def delete_hole(%Hole{} = hole) do
    Repo.delete(hole)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking hole changes.

  ## Examples

      iex> change_hole(hole)
      %Ecto.Changeset{data: %Hole{}}

  """
  def change_hole(%Hole{} = hole, attrs \\ %{}) do
    Hole.changeset(hole, attrs)
  end
end
