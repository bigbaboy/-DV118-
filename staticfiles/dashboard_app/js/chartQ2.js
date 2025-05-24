// chartQ2.js

// Hàm tiện ích wrap text
// Đổi tên thành wrapD3TextChartQ2 cho phù hợp với file
function wrapD3TextChartQ2(text, width) {
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
 
// Đổi tên hàm thành drawChartQ2 và thêm tham số dataPath
async function drawChartQ2(containerSelector, tooltipElement, dataPath) {
    const vizContainer = d3.select(containerSelector);
    vizContainer.html("");
    
    // Tiêu đề cho biểu đồ Q2
    vizContainer.append("h4")
        .style("text-align", "center")
        .style("margin-bottom", "20px")
        .text("Phân tích chi tiết sản phẩm tại Philadelphia (Top 12)"); // Tiêu đề cụ thể cho biểu đồ này

    try {
        // Sử dụng dataPath được truyền vào để tải dữ liệu
        const allData = await d3.csv(dataPath);
        if (!allData || allData.length === 0) {
            throw new Error(`Không tải được file dữ liệu từ ${dataPath} hoặc file rỗng.`);
        }
 
        const philaData = allData.filter(d => d.City === "Philadelphia" && d.Country === "United States");
        if (philaData.length === 0) { vizContainer.html("<p>Không có dữ liệu Philadelphia để vẽ biểu đồ Q2.</p>"); return; }
        
        philaData.forEach(d => { 
            d.Sales = +d.Sales; d.Profit = +d.Profit; d.Quantity = +d.Quantity;
        });
 
        const productSummary = d3.rollup(philaData,
                v => ({ 
                    Total_Sales: d3.sum(v, d => d.Sales), 
                    Total_Profit: d3.sum(v, d => d.Profit), 
                    Total_Quantity: d3.sum(v,d=>d.Quantity), 
                    'Sub-Category': v[0]['Sub-Category'] // Lấy Sub-Category từ bản ghi đầu tiên của nhóm
                }),
                d => d['Product Name']
            );
        let dataForChart = Array.from(productSummary, ([key, value]) => ({
            'Product Name': key, 
            'Sub-Category': value['Sub-Category'], 
            Total_Sales: value.Total_Sales, 
            Total_Profit: value.Total_Profit,
            Overall_Profit_Margin: (value.Total_Sales !== 0) ? (value.Total_Profit / value.Total_Sales) * 100 : 0, 
            Total_Quantity: value.Total_Quantity
        }));
        
        dataForChart = dataForChart.filter(d => d.Total_Sales > 0)
                                   .sort((a,b)=>b.Total_Sales - a.Total_Sales)
                                   .slice(0,12); // Lấy top 12 sản phẩm
 
        if (dataForChart.length === 0) { vizContainer.html("<p>Không có sản phẩm nào ở Philadelphia để hiển thị cho Q2.</p>"); return; }
 
        // --- BẮT ĐẦU CODE D3.JS VẼ BIỂU ĐỒ CỘT NGANG TÙY CHỈNH ---
        const margin = {top: 20, right: 30, bottom: 40, left: 280}; // Tăng left margin cho nhãn Y dài
        const containerRect = vizContainer.node().getBoundingClientRect();
        const width = (containerRect.width > 0 ? containerRect.width * 0.98 : 800) - margin.left - margin.right;
        // Chiều cao động dựa trên số lượng thanh, ví dụ mỗi thanh 35px
        const barHeight = 35;
        const height = Math.max(300, dataForChart.length * barHeight);
 
 
        const svg = vizContainer.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
 
        // Sắp xếp lại dữ liệu để thanh có Sales cao nhất ở trên khi vẽ barh
        dataForChart.sort((a, b) => a.Total_Sales - b.Total_Sales);
 
        // Y Axis (Sub-Category + Product Name)
        const y = d3.scaleBand()
            .range([0, height])
            .domain(dataForChart.map(d => `${d['Sub-Category']}\n${d['Product Name']}`)) // Nhãn 2 dòng
            .padding(0.15);
 
        svg.append("g")
           .call(d3.axisLeft(y).tickSize(0).tickPadding(10))
           .selectAll(".tick text")
           .call(wrapD3TextChartQ2, margin.left - 15) // Sử dụng hàm wrap text đã đổi tên
           .style("font-size", "9px");
 
 
        // X Axis (Sales)
        const x = d3.scaleLinear()
            .domain([0, d3.max(dataForChart, d => d.Total_Sales) || 1])
            .range([0, width]);
 
        svg.append("g")
           .attr("transform", `translate(0,${height})`)
           .call(d3.axisBottom(x).ticks(Math.min(5, width/100)).tickFormat(d3.format("$,.0s")));
 
        // Color Scale cho Biên lợi nhuận
        const profitMargins = dataForChart.map(d => d.Overall_Profit_Margin || 0);
        let minColor = d3.min(profitMargins); let maxColor = d3.max(profitMargins);
        if(minColor === maxColor){ minColor-=10; maxColor+=10;}
        if(minColor > 0 && maxColor > 0 && minColor !== undefined) minColor = -1; // Để có màu đỏ
        if(minColor < 0 && maxColor < 0 && maxColor !== undefined) maxColor = 1; // Để có màu xanh
        if(minColor === undefined) minColor = -10;
        if(maxColor === undefined) maxColor = 10;
 
        const colorScale = d3.scaleDiverging(d3.interpolateRdYlGn)
                             .domain([minColor, 0, maxColor]); // Neo 0 ở giữa (màu vàng)
 
        // Vẽ các thanh ngang
        const bars = svg.selectAll(".prod-bar")
           .data(dataForChart)
           .join("rect")
             .attr("class", "prod-bar")
             .attr("y", d => y(`${d['Sub-Category']}\n${d['Product Name']}`))
             .attr("x", x(0))
             .attr("width", d => x(d.Total_Sales))
             .attr("height", y.bandwidth())
             .attr("fill", d => colorScale(d.Overall_Profit_Margin || 0))
             .style("cursor", "pointer");
 
        // Thêm text (biên lợi nhuận) lên mỗi thanh
        svg.selectAll(".prod-bar-label")
            .data(dataForChart)
            .join("text")
              .attr("class", "prod-bar-label")
              .attr("x", d => x(d.Total_Sales) - 5) // Bên trong, gần cuối thanh
              .attr("y", d => y(`${d['Sub-Category']}\n${d['Product Name']}`) + y.bandwidth() / 2)
              .attr("dy", "0.35em") // Căn giữa theo chiều dọc
              .attr("text-anchor", "end") // Căn phải
              .style("font-size", "9px")
              .style("font-weight", "bold")
              .style("fill", function(d) {
                  const cValue = d.Overall_Profit_Margin || 0;
                  const hslColor = d3.hsl(colorScale(cValue));
                  // Chữ màu đen trên nền sáng (vàng), chữ trắng trên nền tối (đỏ, xanh)
                  return (hslColor.l > 0.4 && hslColor.l < 0.6 && hslColor.s > 0.5) ? '#333' : (hslColor.l > 0.5 ? '#333' : '#fff');
              })
              .text(d => `${(d.Overall_Profit_Margin || 0).toFixed(1)}%`);
        
        // Tooltip
        bars.on("mouseover", function(event, d) {
            tooltipElement.transition().duration(100).style("opacity", .95);
            tooltipElement.html(
                `<strong>${d['Product Name']}</strong><br/>
                 Sub-Category: ${d['Sub-Category']}<br/>
                 Doanh thu: $${(d.Total_Sales || 0).toLocaleString(undefined, {maximumFractionDigits:0})}<br/>
                 Lợi nhuận: $${(d.Total_Profit || 0).toLocaleString(undefined, {maximumFractionDigits:0})}<br/>
                 Biên LN: ${(d.Overall_Profit_Margin || 0).toFixed(1)}%<br/>
                 Số lượng bán: ${d.Total_Quantity || 'N/A'}`
            )
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
            d3.select(this).style("filter", "brightness(1.15)");
        })
        .on("mouseout", function() {
            tooltipElement.transition().duration(300).style("opacity", 0);
            d3.select(this).style("filter", "brightness(1)");
        });
        // --- KẾT THÚC CODE D3.JS ---
 
    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ Q2 (Phân tích sản phẩm Philadelphia): ${error.message}</p>`);
        console.error("Lỗi drawChartQ2:", error);
    }
}