Attribute VB_Name = "Module1"
Option Explicit

Private Sub ApplyColumnView( _
    ByVal ViewRow As Long, _
    Optional ByVal StatusCriteria As Variant)

    Const SHEET_NAME As String = "CGI-ENG-REG-05"
    Const TABLE_NAME As String = "Instramac_Quotes"

    Dim ws As Worksheet
    Dim tbl As ListObject
    Dim statusField As Long
    Dim col As Long
    Dim rowIndex As Long
    Dim dataRange As Range
    Dim targetCell As Range

    Set ws = ThisWorkbook.Worksheets(SHEET_NAME)
    Set tbl = ws.ListObjects(TABLE_NAME)

    Application.ScreenUpdating = False
    Application.EnableEvents = False

    On Error GoTo CleanFail

    'Apply column visibility: 1 = show; 0 or blank = hide
    For col = 1 To tbl.Range.Columns.Count
        ws.Columns(tbl.Range.Column + col - 1).Hidden = _
            (Val(ws.Cells(ViewRow, _
            tbl.Range.Column + col - 1).Value2) <> 1)
    Next col

    'Clear existing table filters
    If tbl.AutoFilter.FilterMode Then
        tbl.AutoFilter.ShowAllData
    End If

    'Apply the required Status filter
    If Not IsMissing(StatusCriteria) Then
        statusField = tbl.ListColumns( _
            "Status" & vbLf & "(See Legend)").Index

        If IsArray(StatusCriteria) Then
            tbl.Range.AutoFilter _
                Field:=statusField, _
                Criteria1:=StatusCriteria, _
                Operator:=xlFilterValues
        Else
            tbl.Range.AutoFilter _
                Field:=statusField, _
                Criteria1:=StatusCriteria
        End If
    End If

    'When resetting, sort the table by Index in ascending order
    If ViewRow = 1 Then
        With tbl.Sort
            .SortFields.Clear
            .SortFields.Add _
                Key:=tbl.ListColumns("Index").DataBodyRange, _
                SortOn:=xlSortOnValues, _
                Order:=xlAscending, _
                DataOption:=xlSortNormal

            .Header = xlYes
            .MatchCase = False
            .Orientation = xlTopToBottom
            .Apply
        End With
    End If

    'Find the last visible row containing data in column P
    Set dataRange = Intersect( _
        tbl.DataBodyRange, ws.Columns("P"))

    For rowIndex = dataRange.Rows.Count To 1 Step -1
        If Not dataRange.Cells( _
            rowIndex, 1).EntireRow.Hidden Then

            If Len(Trim(CStr(dataRange.Cells( _
                rowIndex, 1).Value2))) > 0 Then

                Set targetCell = ws.Cells( _
                    dataRange.Cells(rowIndex, 1).Row, "N")
                Exit For
            End If
        End If
    Next rowIndex

    'Move to column N on the associated row
    If Not targetCell Is Nothing Then
        Application.Goto targetCell, True
    Else
        Application.Goto ws.Range("N9"), True
    End If

CleanExit:
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    Exit Sub

CleanFail:
    MsgBox "The view could not be applied: " & _
        Err.Description, vbExclamation
    Resume CleanExit

End Sub






Public Sub Reset_View()
    'All Status values; sort by Index
    ApplyColumnView 1
End Sub

Public Sub Show_Submitted_Quotes()
    'Status 2, 3, 4, 5, 6 and 6.5
    ApplyColumnView 2, _
        Array("2", "3", "4", "5", "6", "6.5")
End Sub

Public Sub Show_Open_Projects()
    'Status 7
    ApplyColumnView 3, "7"
End Sub

Public Sub Show_Open_Quotes()
    'Status 1
    ApplyColumnView 4, "1"
End Sub

Public Sub Show_Closed_Projects()
    'Row 5 visibility settings; Status 11
    ApplyColumnView 5, "11"
End Sub


Sub FilterSelectedColumnBySelectedValue()

    Dim tbl As ListObject
    Dim fieldNum As Long
    Dim selectedValue As Variant

    Set tbl = ActiveSheet.ListObjects("Instramac_Quotes")

    selectedValue = ActiveCell.Value
    fieldNum = ActiveCell.Column - tbl.Range.Column + 1

    tbl.Range.AutoFilter Field:=fieldNum, Criteria1:=selectedValue

End Sub





