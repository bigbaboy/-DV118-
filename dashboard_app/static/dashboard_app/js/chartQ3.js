// chartQ3.js

// Hàm tiện ích wrap text (cần thiết cho nhãn Y dài)
// Đổi tên thành wrapD3TextChartQ3 để nhất quán với tên file
function wrapD3TextChartQ3(text, width) {
    text.each(function() {
      var text = d3.select(this),
          originalText = text.text(), // Lưu lại text gốc có thể chứa \n
          lines = originalText.split(/\n/), // Tách theo \n trước
          line,
          lineNumber = 0,
          lineHeight = 1.1, // ems
          x = text.attr("x") || 0,
          y = text.attr("y") || 0,
          dy = parseFloat(text.attr("dy") || 0) || 0,
          tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");
    
      if (lines.length > 1 && lines.length <=2) { // Ưu tiên ngắt dòng nếu đã có \n sẵn (cho 2 dòng)
          tspan.text(lines[0]);
          if (lines[1]) {
              tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(lines[1]);
          }
          return;
      }
      
      // Nếu không có \n hoặc nhiều hơn 2 dòng, thì wrap tự động
      const words = originalText.split(/\s+/).filter(Boolean).reverse(); // Tách theo khoảng trắng
      lineNumber = 0; // Reset
      let currentLineArray = [];
      tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em"); // Reset tspan
    
      while (word = words.pop()) {
        currentLineArray.push(word);
        tspan.text(currentLineArray.join(" "));
        if (tspan.node().getComputedTextLength() > width && currentLineArray.length > 1) {
          currentLineArray.pop();
          tspan.text(currentLineArray.join(" "));
          currentLineArray = [word];
          tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
        }
      }
    });
}
 
// Đổi tên hàm thành drawChartQ3 và thêm tham số dataPath
async function drawChartQ3(containerSelector, tooltipElement, dataPath) {
    const vizContainer = d3.select(containerSelector);
    vizContainer.html(""); // Xóa nội dung cũ

    // Tiêu đề cho biểu đồ Q3
    vizContainer.append("h4")
        .style("text-align", "center")
        .style("margin-bottom", "20px")
        .text("Phân tích Doanh thu và Lợi nhuận theo Sub-Category tại Philadelphia"); // Tiêu đề cụ thể cho biểu đồ này

    try {
        // Sử dụng dataPath được truyền vào để tải dữ liệu
        const allData = await d3.csv(dataPath);
        if (!allData || allData.length === 0) {
            throw new Error(`Không tải được file dữ liệu từ ${dataPath} hoặc file rỗng.`);
        }

        // 1. Lọc dữ liệu cho Philadelphia
        const philaData = allData.filter(d => d.City === "Philadelphia" && d.Country === "United States");
        if (philaData.length === 0) {
            vizContainer.html("<p>Không có dữ liệu cho Philadelphia để vẽ Biểu đồ Q3.</p>");
            return;
        }

        // 2. Xử lý dữ liệu: Chuyển đổi kiểu và Gom nhóm theo Sub-Category
        philaData.forEach(d => {
            d.Sales = +d.Sales;
            d.Profit = +d.Profit;
        });

        const subCategorySummary = d3.rollup(philaData,
            v => ({
                Total_Sales: d3.sum(v, d => d.Sales),
                Total_Profit: d3.sum(v, d => d.Profit)
            }),
            d => d['Sub-Category'] // Sử dụng tên cột Sub-Category trong file CSV của bạn
        );

        let dataForChart = Array.from(subCategorySummary, ([key, value]) => ({
            'Sub-Category': key,
            Total_Sales: value.Total_Sales,
            Profit_Margin_Overall: (value.Total_Sales !== 0) ? (value.Total_Profit / value.Total_Sales) * 100 : 0
        }));

        // Sắp xếp theo Total_Sales giảm dần để hiển thị trên trục X theo thứ tự đó
        dataForChart.sort((a, b) => b.Total_Sales - a.Total_Sales);

        if (dataForChart.length === 0) {
            vizContainer.html("<p>Không có dữ liệu Sub-Category sau khi xử lý cho Philadelphia.</p>");
            return;
        }

        // --- BẮT ĐẦU CODE D3.JS VẼ BIỂU ĐỒ CỘT + ĐƯỜNG ---
        const margin = { top: 40, right: 70, bottom: 120, left: 80 }; // Tăng bottom margin cho nhãn x xoay
        const containerRect = vizContainer.node().getBoundingClientRect();
        const width = (containerRect.width > 0 ? containerRect.width * 0.98 : 800) - margin.left - margin.right;
        const height = 450 - margin.top - margin.bottom;

        const svg = vizContainer.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // X Axis (Sub-Category)
        const x = d3.scaleBand()
            .range([0, width])
            .domain(dataForChart.map(d => d['Sub-Category']))
            .padding(0.2);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "translate(-10,5)rotate(-45)")
            .style("text-anchor", "end")
            .style("font-size", "10px");

        // Y1 Axis (Total Sales - Bar)
        const y1Max = d3.max(dataForChart, d => d.Total_Sales);
        const y1 = d3.scaleLinear()
            .domain([0, y1Max > 0 ? y1Max * 1.1 : 1])
            .range([height, 0]);

        const y1Axis = svg.append("g")
            .call(d3.axisLeft(y1).ticks(6).tickFormat(d3.format("$,.0s")));

        y1Axis.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -margin.left + 20)
            .attr("x", -height / 2)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("fill", "steelblue")
            .style("font-size", "11px")
            .text("Tổng Doanh thu ($)");

        // Bars for Sales
        const bars = svg.selectAll(".bar-phila-subcat-sales")
            .data(dataForChart)
            .join("rect")
            .attr("class", "bar-phila-subcat-sales")
            .attr("x", d => x(d['Sub-Category']))
            .attr("y", d => y1(d.Total_Sales))
            .attr("width", x.bandwidth())
            .attr("height", d => Math.max(0, height - y1(d.Total_Sales))) // Đảm bảo height không âm
            .attr("fill", "steelblue")
            .style("cursor", "pointer");

        // Y2 Axis (Profit Margin - Line)
        const profitMargins = dataForChart.map(d => d.Profit_Margin_Overall);
        let y2Min = d3.min(profitMargins);
        let y2Max = d3.max(profitMargins);

        // Xử lý trường hợp tất cả margin là 0 hoặc không xác định
        if (y2Min === undefined || y2Max === undefined || (y2Min === 0 && y2Max === 0) ) {
            y2Min = -10; y2Max = 10;
        } else {
            if (y2Min > 0) y2Min = 0;
            if (y2Max < 0) y2Max = 0;
            const y2Padding = (y2Max - y2Min) * 0.1 || 5; // Hoặc một giá trị padding cố định
            y2Min -= y2Padding;
            y2Max += y2Padding;
        }
        
        const y2 = d3.scaleLinear()
            .domain([y2Min, y2Max])
            .range([height, 0]);

        const y2Axis = svg.append("g")
            .attr("transform", `translate(${width},0)`)
            .call(d3.axisRight(y2).ticks(5).tickFormat(d => `${d.toFixed(0)}%`));

        y2Axis.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", margin.right - 25)
            .attr("x", -height / 2)
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("fill", "orangered")
            .style("font-size", "11px")
            .text("Biên Lợi Nhuận (%)");

        // Đường tham chiếu 0% cho Biên lợi nhuận
        if (y2.domain()[0] < 0 && y2.domain()[1] > 0) {
            svg.append("line")
                .attr("x1", 0).attr("x2", width)
                .attr("y1", y2(0)).attr("y2", y2(0))
                .attr("stroke", "grey").attr("stroke-width", 1.5).attr("stroke-dasharray", "3,3");
        }

        // Line for Profit Margin
        svg.append("path")
            .datum(dataForChart)
            .attr("fill", "none")
            .attr("stroke", "orangered").attr("stroke-width", 2)
            .attr("d", d3.line()
                .x(d => x(d['Sub-Category']) + x.bandwidth() / 2)
                .y(d => y2(d.Profit_Margin_Overall))
            );
        
        // Dots for Profit Margin
        const dots = svg.selectAll(".dot-phila-subcat-margin")
            .data(dataForChart)
            .join("circle")
            .attr("class", "dot-phila-subcat-margin")
            .attr("cx", d => x(d['Sub-Category']) + x.bandwidth() / 2)
            .attr("cy", d => y2(d.Profit_Margin_Overall))
            .attr("r", 4).attr("fill", "orangered").style("cursor", "pointer");

        // Tooltip (gắn cho cả cột và điểm)
        const combinedHoverTargets = svg.selectAll(".bar-phila-subcat-sales, .dot-phila-subcat-margin");

        combinedHoverTargets
            .on("mouseover", function(event, d) {
                tooltipElement.transition().duration(100).style("opacity", .95);
                tooltipElement.html(
                    `<strong>${d['Sub-Category']}</strong><br/>
                     Doanh thu: $${d.Total_Sales.toLocaleString(undefined, {maximumFractionDigits:0})}<br/>
                     Lợi nhuận: $${d.Total_Profit.toLocaleString(undefined, {maximumFractionDigits:0})}<br/>
                     Biên LN: ${d.Profit_Margin_Overall.toFixed(1)}%`
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
                d3.select(this).style("filter", "brightness(1.2)");
            })
            .on("mouseout", function() {
                tooltipElement.transition().duration(300).style("opacity", 0);
                d3.select(this).style("filter", "brightness(1)");
            });
        // --- KẾT THÚC CODE D3.JS ---

    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ Q3 (Phân tích Sub-Category Philadelphia): ${error.message}</p>`);
        console.error("Lỗi drawChartQ3:", error);
    }
}