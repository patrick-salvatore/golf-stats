defmodule GolfStatsServer.Courses do
  @moduledoc """
  The Courses context.
  """

  import Ecto.Query, warn: false
  alias GolfStatsServer.Repo

  alias GolfStatsServer.Courses.Course

  @doc """
  Returns the list of courses.
  """
  def list_courses do
    Repo.all(Course)
  end

  def search_courses(query) do
    search = "%#{String.downcase(query)}%"

    from(c in Course,
      where: like(fragment("lower(?)", c.name), ^search),
      order_by: c.name
    )
    |> Repo.all()
  end

  @doc """
  Gets a single course.
  """
  def get_course!(id), do: Repo.get!(Course, id)

  def get_course_with_holes!(id) do
    Course
    |> Repo.get!(id)
    |> Repo.preload(hole_definitions: [order_by: :hole_number])
  end

  @doc """
  Creates a course.

  ## Examples

      iex> create_course(%{field: value})
      {:ok, %Course{}}

      iex> create_course(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_course(attrs \\ %{}) do
    %Course{}
    |> Course.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a course.

  ## Examples

      iex> update_course(course, %{field: new_value})
      {:ok, %Course{}}

      iex> update_course(course, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_course(%Course{} = course, attrs) do
    course
    |> Course.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a course.

  ## Examples

      iex> delete_course(course)
      {:ok, %Course{}}

      iex> delete_course(course)
      {:error, %Ecto.Changeset{}}

  """
  def delete_course(%Course{} = course) do
    Repo.delete(course)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking course changes.

  ## Examples

      iex> change_course(course)
      %Ecto.Changeset{data: %Course{}}

  """
  def change_course(%Course{} = course, attrs \\ %{}) do
    Course.changeset(course, attrs)
  end
end
