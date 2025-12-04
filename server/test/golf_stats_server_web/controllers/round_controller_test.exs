defmodule GolfStatsServerWeb.RoundControllerTest do
  use GolfStatsServerWeb.ConnCase

  import GolfStatsServer.StatsFixtures

  alias GolfStatsServer.Round

  @create_attrs %{
    date: ~D[2025-12-03],
    course_name: "some course_name",
    total_score: 42
  }
  @update_attrs %{
    date: ~D[2025-12-04],
    course_name: "some updated course_name",
    total_score: 43
  }
  @invalid_attrs %{date: nil, course_name: nil, total_score: nil}

  setup %{conn: conn} do
    {:ok, conn: put_req_header(conn, "accept", "application/json")}
  end

  describe "index" do
    test "lists all rounds", %{conn: conn} do
      conn = get(conn, ~p"/api/rounds")
      assert json_response(conn, 200)["data"] == []
    end
  end

  describe "create round" do
    test "renders round when data is valid", %{conn: conn} do
      conn = post(conn, ~p"/api/rounds", round: @create_attrs)
      assert %{"id" => id} = json_response(conn, 201)["data"]

      conn = get(conn, ~p"/api/rounds/#{id}")

      assert %{
               "id" => ^id,
               "course_name" => "some course_name",
               "date" => "2025-12-03",
               "total_score" => 42
             } = json_response(conn, 200)["data"]
    end

    test "renders errors when data is invalid", %{conn: conn} do
      conn = post(conn, ~p"/api/rounds", round: @invalid_attrs)
      assert json_response(conn, 422)["errors"] != %{}
    end
  end

  describe "update round" do
    setup [:create_round]

    test "renders round when data is valid", %{conn: conn, round: %Round{id: id} = round} do
      conn = put(conn, ~p"/api/rounds/#{round}", round: @update_attrs)
      assert %{"id" => ^id} = json_response(conn, 200)["data"]

      conn = get(conn, ~p"/api/rounds/#{id}")

      assert %{
               "id" => ^id,
               "course_name" => "some updated course_name",
               "date" => "2025-12-04",
               "total_score" => 43
             } = json_response(conn, 200)["data"]
    end

    test "renders errors when data is invalid", %{conn: conn, round: round} do
      conn = put(conn, ~p"/api/rounds/#{round}", round: @invalid_attrs)
      assert json_response(conn, 422)["errors"] != %{}
    end
  end

  describe "delete round" do
    setup [:create_round]

    test "deletes chosen round", %{conn: conn, round: round} do
      conn = delete(conn, ~p"/api/rounds/#{round}")
      assert response(conn, 204)

      assert_error_sent 404, fn ->
        get(conn, ~p"/api/rounds/#{round}")
      end
    end
  end

  defp create_round(_) do
    round = round_fixture()
    %{round: round}
  end
end
